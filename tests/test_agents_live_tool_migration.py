"""Historical MCP live-backing migration coverage."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from angee.agents.runtime_migrations.live_tool_backing import populate_grant_ids
from angee.base.fields import SqidField


class _Rows:
    def __init__(self, values: list[Any]) -> None:
        self.values = values

    def using(self, database: str) -> _Rows:
        assert database == "default"
        return self

    def iterator(self) -> Any:
        return iter(self.values)


def test_tool_grant_backfill_encodes_server_pk_through_historical_field() -> None:
    """The concrete grant id uses the retired server public id without a virtual field."""

    saved: list[tuple[str, ...]] = []
    tool = SimpleNamespace(
        server_id=7,
        name="search",
        save=lambda *, update_fields: saved.append(update_fields),
    )
    rows = _Rows([tool])
    models = {("agents", "MCPTool"): SimpleNamespace(_base_manager=rows)}

    populate_grant_ids(
        SimpleNamespace(get_model=lambda app, model: models[(app, model)]),
        SimpleNamespace(connection=SimpleNamespace(alias="default")),
    )

    assert tool.grant_id == f"{_public_id(7, 'mcp_')}.search"
    assert saved == [("grant_id",)]


def _public_id(value: int, prefix: str) -> str:
    return SqidField(real_field_name="id", prefix=prefix, min_length=8).public_id_from_value(value)
