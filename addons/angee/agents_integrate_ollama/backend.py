"""Ollama specialization of the OpenAI-compatible inference backend."""

from __future__ import annotations

from typing import Any, ClassVar

from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.profiles.openai import OpenAIModelProfile
from pydantic_ai.providers.openai import OpenAIProvider

from angee.agents_integrate_openai.backend import OpenAIInferenceBackend


class OllamaInferenceBackend(OpenAIInferenceBackend):
    """OpenAI-compatible inference served by a local Ollama endpoint."""

    key = "ollama"
    label = "Ollama"
    icon = "ollama"
    defaults = {
        "vendor": "ollama",
        "name": "Ollama",
    }
    default_base_url = "http://localhost:11434/v1"
    requires_credential = False
    default_broker_name = "ollama"
    model_allow_prefixes: ClassVar[tuple[str, ...]] = ()
    model_deny_prefixes: ClassVar[tuple[str, ...]] = ()
    api_key_env: ClassVar[tuple[str, ...]] = ()

    def _build_model(self, handle: str, client: Any) -> OpenAIChatModel:
        """Declare Ollama's OpenAI-compatible native JSON-schema envelope."""

        return OpenAIChatModel(
            handle,
            provider=OpenAIProvider(openai_client=client),
            profile=OpenAIModelProfile(
                supports_json_schema_output=True,
                default_structured_output_mode="native",
                openai_chat_supports_max_completion_tokens=(
                    self._max_tokens_param() == "max_completion_tokens"
                ),
            ),
        )
