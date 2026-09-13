"""Focused contracts for generic extraction evidence and the local GLM adapter."""

from __future__ import annotations

import io
from contextlib import nullcontext
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from django.core.exceptions import ValidationError
from PIL import Image
from pydantic_ai.messages import ModelResponse, ToolCallPart

from angee.workflows_ocr.engines import (
    DocumentPart,
    DocumentPipelineError,
    DocumentSource,
    InferenceMappingEngine,
    PageImage,
    PageResult,
)
from angee.workflows_ocr.routing import acquire_native_parts
from angee.workflows_ocr import service
from angee.workflows_ocr.service import _merge, _validated_schema
from angee.workflows_ocr_glm.engine import GlmOllamaEngine
from tests.ocr_engines import FakeOcrEngine

SCHEMA = {
    "$id": "test.document.v1",
    "type": "object",
    "properties": {"number": {"type": "string"}},
    "required": ["number"],
    "additionalProperties": False,
}


def _page(source: int, page: int) -> PageImage:
    return PageImage(source, page, "image/jpeg", b"synthetic", 10, 10, 200)


def test_fake_engine_addresses_pages_by_source_and_page_without_collisions() -> None:
    engine = FakeOcrEngine()
    config = {"page_results": {"0:1": {"number": "first"}, "1:0": {"number": "second"}}}
    assert engine.extract_page(_page(0, 1), SCHEMA, model=None, config=config, timeout=1).value == {"number": "first"}
    assert engine.extract_page(_page(1, 0), SCHEMA, model=None, config=config, timeout=1).value == {"number": "second"}


def test_merge_preserves_repeated_rows_and_records_conflicting_claims() -> None:
    result, conflicts = _merge(
        [
            PageResult({"number": "A", "lines": [{"description": "same"}]}),
            PageResult({"number": "B", "lines": [{"description": "same"}]}),
        ]
    )
    assert result == {
        "number": "A",
        "lines": [{"description": "same"}, {"description": "same"}],
    }
    assert conflicts == {"number": ["A", "B"]}


def test_schema_owner_requires_object_root() -> None:
    assert _validated_schema(SCHEMA) == SCHEMA
    with pytest.raises(ValidationError, match="root must have type object"):
        _validated_schema({"$id": "bad", "type": "array"})


def test_reextract_uses_newest_lineage_revision_and_reuses_newest_success(monkeypatch: pytest.MonkeyPatch) -> None:
    """Recovery advances only within the original frozen extraction policy."""

    target = SimpleNamespace(has_access=lambda _permission: True)
    original = SimpleNamespace(
        status="failed",
        lineage_key="lineage",
        engine="inference_document",
        model_id=1,
        recognition_model_id=2,
        schema_digest="schema",
        engine_config={"timeout": 30},
    )
    sources = MagicMock()
    sources.select_related.return_value.order_by.return_value = []
    different_model = SimpleNamespace(
        status="succeeded",
        revision=4,
        engine="inference_document",
        model_id=99,
        recognition_model_id=2,
        schema_digest="schema",
        engine_config={"timeout": 30},
    )
    latest = SimpleNamespace(
        status="succeeded",
        revision=3,
        engine="inference_document",
        model_id=1,
        recognition_model_id=2,
        schema_digest="schema",
        engine_config={"timeout": 30, "retry_of_revision": 2},
        sources=sources,
        target=target,
        model=None,
        recognition_model=None,
    )
    manager = MagicMock()
    manager.filter.return_value.order_by.return_value = [different_model, latest]
    extraction_model = SimpleNamespace(_base_manager=manager)
    monkeypatch.setattr(service.apps, "get_model", lambda *_args: extraction_model)
    monkeypatch.setattr(service, "system_context", lambda **_kwargs: nullcontext())
    extract_call = MagicMock()
    monkeypatch.setattr(service, "extract", extract_call)

    assert service.reextract(original) is latest
    extract_call.assert_not_called()

    latest.status = "failed"
    latest.schema = SCHEMA
    retried = SimpleNamespace(status="succeeded")
    extract_call.return_value = retried

    assert service.reextract(original) is retried
    assert extract_call.call_args.kwargs["config"] == {"timeout": 30, "retry_of_revision": 3}


def test_inference_mapping_uses_catalogue_model_without_provider_restriction() -> None:
    response = SimpleNamespace(
        text='{"number":"INV-42"}',
        usage=SimpleNamespace(input_tokens=23, output_tokens=7),
        provider_response_id="response-1",
    )
    requested = {}

    def chat(messages, *, model_settings, model_request_parameters):
        requested.update(settings=model_settings, parameters=model_request_parameters)
        return response

    model = SimpleNamespace(
        status="available",
        model_use="chat",
        provider=SimpleNamespace(
            backend_class="anthropic",
            backend=SimpleNamespace(),
        ),
        chat=chat,
    )
    part = DocumentPart(0, None, "text/plain", "native_text", "Invoice INV-42", "native", "hash")

    value, claims, metadata = InferenceMappingEngine().map_text_parts(
        (part,), SCHEMA, model=model, config={"max_tokens": 128}, timeout=5,
    )

    assert value == {"number": "INV-42"}
    assert claims["/number"][0]["part_position"] == 0
    assert metadata["input_tokens"] == 23
    assert metadata["output_tokens"] == 7
    assert requested["parameters"].output_mode == "auto"
    assert requested["parameters"].output_object.json_schema == SCHEMA


def test_inference_mapping_consumes_native_structured_tool_result() -> None:
    response = ModelResponse(
        parts=[ToolCallPart("document_extraction", {"number": "INV-43"}, "call-1")]
    )
    response.usage.input_tokens = 19
    response.usage.output_tokens = 5
    model = SimpleNamespace(
        status="available",
        model_use="chat",
        chat=lambda *args, **kwargs: response,
    )

    value, _claims, _metadata = InferenceMappingEngine().map_text_parts(
        (DocumentPart(0, None, "text/plain", "native_text", "Invoice INV-43", "native", "hash"),),
        SCHEMA,
        model=model,
        config={},
        timeout=5,
    )

    assert value == {"number": "INV-43"}


def test_glm_engine_rejects_nonlocal_provider_before_sending_page() -> None:
    model = SimpleNamespace(
        name="glm-ocr:latest",
        provider=SimpleNamespace(backend_class="ollama", base_url="https://example.invalid/v1"),
    )
    with pytest.raises(ValueError, match="loopback Ollama"):
        GlmOllamaEngine().extract_page(_page(0, 0), SCHEMA, model=model, config={}, timeout=1)


@pytest.mark.parametrize("base_url", [
    "https://example.invalid/v1", "ftp://localhost/v1", "http://user:pass@localhost/v1",
    "http://localhost/v1?token=secret", "http://localhost/v1#fragment",
])
def test_glm_configuration_and_execution_reject_the_same_provider(base_url, monkeypatch):
    model = SimpleNamespace(
        status="available", model_use="multimodal", provider_model_name="test-model",
        provider=SimpleNamespace(backend_class="ollama", base_url=base_url),
    )
    def unexpected_request(*args, **kwargs):
        raise AssertionError("An invalid provider must never receive document evidence.")
    monkeypatch.setattr("httpx.Client", unexpected_request)
    engine = GlmOllamaEngine()
    with pytest.raises(ValueError, match="loopback Ollama"):
        engine.validate_model(model, role="recognition")
    with pytest.raises(ValueError, match="loopback Ollama"):
        engine.recognize_page(_page(0, 0), model=model, config={}, timeout=1)


def test_glm_model_roles_and_retired_status_share_the_execution_validator():
    model = SimpleNamespace(
        status="available", model_use="chat",
        provider=SimpleNamespace(backend_class="ollama", base_url="http://localhost:11434/v1"),
    )
    engine = GlmOllamaEngine()
    engine.validate_model(model, role="mapping")
    with pytest.raises(ValueError, match="image-capable"):
        engine.validate_model(model, role="recognition")
    model.model_use = "multimodal"
    engine.validate_model(model, role="recognition")
    model.status = "retired"
    with pytest.raises(ValueError, match="available"):
        engine.validate_model(model, role="mapping")


def test_native_acquisition_converts_input_errors_to_retained_pipeline_failures() -> None:
    source = DocumentSource(0, "a" * 64, "image/png", b"not an image")
    with pytest.raises(DocumentPipelineError, match=r"acquisition failed \(ValueError\)"):
        acquire_native_parts((source,))

    acquired = DocumentSource(0, "b" * 64, "text/plain", "retained", message_part=object())
    failed = DocumentSource(1, "a" * 64, "image/png", b"not an image")
    with pytest.raises(DocumentPipelineError) as error:
        acquire_native_parts((acquired, failed))
    assert [part.value for part in error.value.parts] == ["retained"]

    nul_text = DocumentSource(0, "c" * 64, "text/plain", b"invoice\x00text")
    with pytest.raises(DocumentPipelineError, match="acquisition failed"):
        acquire_native_parts((nul_text,))


@pytest.mark.parametrize("kind", ["text", "scan", "structured"])
def test_glm_document_pipeline_uses_native_evidence_before_model_mapping(kind, monkeypatch):
    if kind == "text":
        content, mime = b"Invoice DOC-1", "text/plain"
    elif kind == "scan":
        stream = io.BytesIO()
        Image.new("RGB", (32, 32), "white").save(stream, format="PNG")
        content, mime = stream.getvalue(), "image/png"
    else:
        content = (
            b'<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" '
            b'xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">'
            b"<cbc:ID>DOC-1</cbc:ID></Invoice>"
        )
        mime = "application/xml"
    calls = []
    model, recognizer = object(), object()

    def generate(self, prompt, **kwargs):
        calls.append((prompt, kwargs))
        assert 0 < kwargs["timeout"] <= 10
        return ("Invoice DOC-1" if kwargs.get("page") else '{"number":"DOC-1"}'), {"duration_ms": 1}

    monkeypatch.setattr(GlmOllamaEngine, "_generate", generate)
    result = GlmOllamaEngine().extract_document(
        (DocumentSource(0, "a" * 64, mime, content),),
        SCHEMA,
        model=model,
        recognition_model=recognizer,
        config={},
        timeout=10,
    )
    assert result.value == {"number": "DOC-1"}
    assert len(calls) == (2 if kind == "scan" else 1)
    assert calls[-1][1]["model"] is model
    assert "DOC-1" in calls[-1][0]
    assert result.parts[0].kind == {"text": "native_text", "scan": "recognized_text", "structured": "structured"}[kind]
    if kind == "scan":
        assert calls[0][1]["model"] is recognizer
    else:
        assert not calls[0][1].get("page")


def test_glm_mapping_failure_retains_acquired_evidence_and_bounds_vendor_error(monkeypatch):
    def fail(*args, **kwargs):
        raise RuntimeError("private vendor response")

    monkeypatch.setattr(GlmOllamaEngine, "_generate", fail)
    with pytest.raises(DocumentPipelineError) as failure:
        GlmOllamaEngine().extract_document(
            (DocumentSource(0, "b" * 64, "text/plain", b"Invoice DOC-1"),),
            SCHEMA,
            model=object(),
            recognition_model=None,
            config={},
            timeout=10,
        )
    assert failure.value.parts[0].value == "Invoice DOC-1"
    assert "private" not in str(failure.value)
