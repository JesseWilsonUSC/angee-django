"""Append-only evidence collections and atomic revision allocation."""

from collections.abc import Sequence
from copy import deepcopy
from typing import Any

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from rebac import system_context

from angee.base.models import AngeeManager, AngeeQuerySet
from angee.workflows.attempts import json_values_equal
from angee.workflows_ocr.engines import DocumentPart, DocumentSource, PageImage, PageResult


class ImmutableEvidenceQuerySet(AngeeQuerySet[Any]):
    """Prevent post-insert mutation and deletion through bulk ORM paths."""

    def update(self, **kwargs: Any) -> int:
        raise ValueError("Extraction evidence is immutable.")

    def delete(self) -> tuple[int, dict[str, int]]:
        raise ValueError("Extraction evidence is retained and cannot be deleted through the ORM.")


ImmutableEvidenceManager: Any = AngeeManager.from_queryset(ImmutableEvidenceQuerySet)


class ExtractionManager(ImmutableEvidenceManager):
    """Persist one authorized result and all of its ordered evidence atomically."""

    def create_revision(
        self,
        *,
        sources: Sequence[DocumentSource],
        pages: Sequence[PageImage],
        page_results: Sequence[PageResult],
        parts: Sequence[DocumentPart],
        **values: Any,
    ) -> Any:
        """Reuse exact requests or allocate the next revision with fresh engine evidence."""

        return self._create_revision(values=values, evidence=(sources, pages, page_results, parts))

    def create_revision_from_evidence(self, original: Any, **values: Any) -> Any:
        """Allocate a revision by cloning an authorized immutable evidence snapshot.

        ``original`` must still be the lineage head. Exact retries reuse the
        correction already allocated for the same authority key; a different
        result for that key is rejected rather than branching retained facts.
        """

        return self._create_revision(values=values, original=original)

    def _create_revision(
        self,
        *,
        values: dict[str, Any],
        evidence: tuple[
            Sequence[DocumentSource],
            Sequence[PageImage],
            Sequence[PageResult],
            Sequence[DocumentPart],
        ] | None = None,
        original: Any | None = None,
    ) -> Any:
        """Own revision locking, retry, reuse, and child persistence once."""

        if (evidence is None) == (original is None):
            raise TypeError("Provide either fresh evidence or one retained extraction.")
        with system_context(reason="workflows_ocr.extraction.create_revision"):
            for attempt in range(3):
                try:
                    with transaction.atomic(using=self.db):
                        existing = self.filter(reuse_key=values["reuse_key"]).first()
                        if existing is not None:
                            return self._validated_reuse(existing, original=original, values=values)
                        previous = (
                            self.lock_if_supported()
                            .filter(lineage_key=values["lineage_key"])
                            .order_by("-revision")
                            .first()
                        )
                        if original is not None and (previous is None or previous.pk != original.pk):
                            raise ValidationError({
                                "extraction": "The correction source is no longer the current extraction revision."
                            })
                        extraction = self.create(revision=previous.revision + 1 if previous else 1, **values)
                        if evidence is not None:
                            self._persist_fresh_evidence(extraction, *evidence)
                        else:
                            self._clone_retained_evidence(extraction, original)
                        return extraction
                except IntegrityError:
                    duplicate = self.filter(reuse_key=values["reuse_key"]).first()
                    if duplicate is not None:
                        return self._validated_reuse(duplicate, original=original, values=values)
                    if attempt == 2:
                        raise
        raise AssertionError("Unreachable revision allocation state.")

    def _validated_reuse(self, existing: Any, *, original: Any | None, values: dict[str, Any]) -> Any:
        if original is None:
            return existing
        if (
            existing.lineage_key != values["lineage_key"]
            or existing.schema_digest != values["schema_digest"]
            or not json_values_equal(existing.result, values["result"])
            or not json_values_equal(
                _stable_correction_provenance(existing.provenance),
                _stable_correction_provenance(values["provenance"]),
            )
        ):
            raise ValidationError({"decision": "This Decision already owns a different correction revision."})
        return existing

    def _evidence_models(self) -> tuple[type[Any], type[Any], type[Any]]:
        registry = self.model._meta.apps
        return (
            registry.get_model("workflows_ocr", "ExtractionSource"),
            registry.get_model("workflows_ocr", "ExtractionPage"),
            registry.get_model("workflows_ocr", "ExtractionPart"),
        )

    def _persist_fresh_evidence(
        self,
        extraction: Any,
        sources: Sequence[DocumentSource],
        pages: Sequence[PageImage],
        page_results: Sequence[PageResult],
        parts: Sequence[DocumentPart],
    ) -> None:
        source_model, page_model, part_model = self._evidence_models()
        retained_sources = source_model._base_manager.using(self.db).bulk_create(
            [
                source_model(
                    extraction=extraction,
                    position=source.source_position,
                    file=source.file,
                    message_part=source.message_part,
                    content_hash=source.content_hash,
                )
                for source in sources
            ]
        )
        source_by_position = {source.position: source for source in retained_sources}
        page_model._base_manager.using(self.db).bulk_create(
            [
                page_model(
                    extraction=extraction,
                    source=source_by_position[page.source_position],
                    position=position,
                    source_page=page.page_position,
                    width=page.width,
                    height=page.height,
                    dpi=page.dpi,
                    duration_ms=max(result.duration_ms, 0),
                    result=result.value,
                    engine_metadata=result.engine_metadata or {},
                )
                for position, (page, result) in enumerate(zip(pages, page_results))
            ]
        )
        claims = extraction.provenance["claims"]
        part_model._base_manager.using(self.db).bulk_create(
            [
                part_model(
                    extraction=extraction,
                    source=source_by_position[part.source_position],
                    position=position,
                    source_page=part.source_page,
                    mime_type=part.mime_type,
                    kind=part.kind,
                    method=part.method,
                    content_hash=part.content_hash,
                    width=part.width,
                    height=part.height,
                    dpi=part.dpi,
                    value=part.value,
                    claims=_claims_for_part(claims, position),
                    metadata=part.metadata or {},
                    duration_ms=max(part.duration_ms, 0),
                )
                for position, part in enumerate(parts)
            ]
        )

    def _clone_retained_evidence(self, extraction: Any, original: Any) -> None:
        source_model, page_model, part_model = self._evidence_models()
        original_sources = list(
            source_model._base_manager.using(self.db).filter(extraction=original).order_by("position")
        )
        if [source.position for source in original_sources] != list(range(len(original_sources))):
            raise ValidationError({"extraction": "The retained source ordering is invalid."})
        retained_sources = source_model._base_manager.using(self.db).bulk_create(
            [
                source_model(
                    extraction=extraction,
                    position=source.position,
                    file_id=source.file_id,
                    message_part_id=source.message_part_id,
                    content_hash=source.content_hash,
                )
                for source in original_sources
            ]
        )
        source_by_id = {
            original_source.pk: retained_source
            for original_source, retained_source in zip(original_sources, retained_sources)
        }
        original_pages = list(
            page_model._base_manager.using(self.db).filter(extraction=original).order_by("position")
        )
        if [page.position for page in original_pages] != list(range(len(original_pages))):
            raise ValidationError({"extraction": "The retained page ordering is invalid."})
        page_model._base_manager.using(self.db).bulk_create(
            [
                page_model(
                    extraction=extraction,
                    source=source_by_id[page.source_id],
                    position=page.position,
                    source_page=page.source_page,
                    width=page.width,
                    height=page.height,
                    dpi=page.dpi,
                    duration_ms=page.duration_ms,
                    result=page.result,
                    engine_metadata=page.engine_metadata,
                )
                for page in original_pages
            ]
        )
        original_parts = list(
            part_model._base_manager.using(self.db).filter(extraction=original).order_by("position")
        )
        if [part.position for part in original_parts] != list(range(len(original_parts))):
            raise ValidationError({"extraction": "The retained part ordering is invalid."})
        claims = extraction.provenance["claims"]
        part_model._base_manager.using(self.db).bulk_create(
            [
                part_model(
                    extraction=extraction,
                    source=source_by_id[part.source_id],
                    position=part.position,
                    source_page=part.source_page,
                    mime_type=part.mime_type,
                    kind=part.kind,
                    method=part.method,
                    content_hash=part.content_hash,
                    width=part.width,
                    height=part.height,
                    dpi=part.dpi,
                    value=part.value,
                    claims=_claims_for_part(claims, part.position),
                    metadata=part.metadata,
                    duration_ms=part.duration_ms,
                )
                for part in original_parts
            ]
        )


def _claims_for_part(claims: dict[str, list[dict[str, Any]]], position: int) -> dict[str, list[dict[str, Any]]]:
    return {
        pointer: matching
        for pointer, entries in claims.items()
        if (matching := [claim for claim in entries if claim["part_position"] == position])
    }


def _stable_correction_provenance(provenance: Any) -> dict[str, Any]:
    """Exclude the first materializer actor from exact authority reuse checks."""

    value = deepcopy(provenance)
    corrections = value.get("corrections")
    if isinstance(corrections, list) and corrections and isinstance(corrections[-1], dict):
        corrections[-1].pop("recorded_by", None)
    return value
