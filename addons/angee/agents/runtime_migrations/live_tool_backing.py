"""Give persisted MCP tools their stable catalogue key."""

from django.core.exceptions import ImproperlyConfigured
from django.db import migrations, models
from django.db.migrations.state import ProjectState

from angee.base.fields import SqidField


def _legacy_id(value, *, prefix):
    """Encode one historical public id through its owning field implementation."""

    return SqidField(real_field_name="id", prefix=prefix, min_length=8).public_id_from_value(value)


def applies(project_state: ProjectState) -> bool:
    """Apply only to the exact pre-grant-id MCP catalogue state."""

    tool = project_state.models.get(("agents", "mcptool"))
    agent = project_state.models.get(("agents", "agent"))
    server = project_state.models.get(("agents", "mcpserver"))
    if tool is None and agent is None and server is None:
        return False
    if tool is None or agent is None or server is None:
        raise ImproperlyConfigured(
            "angee.agents:live_tool_backing found only part of its MCP model state"
        )
    required_tool = {"server", "name"}
    required_agent = {"user", "mcp_tools", "mcp_servers"}
    if "grant_id" in tool.fields:
        grant_id = tool.fields["grant_id"]
        if (
            isinstance(grant_id, models.CharField)
            and grant_id.max_length == 260
            and grant_id.unique
            and not grant_id.null
            and not grant_id.editable
        ):
            return False
        raise ImproperlyConfigured(
            "angee.agents:live_tool_backing found a partial MCPTool grant-id state"
        )
    if not required_tool.issubset(tool.fields) or not required_agent.issubset(agent.fields):
        raise ImproperlyConfigured(
            "angee.agents:live_tool_backing found an unexpected MCP selection state"
        )
    return True


def populate_grant_ids(apps, schema_editor) -> None:
    """Backfill each tool from its persisted server primary key and tool name."""

    database = schema_editor.connection.alias
    tool_model = apps.get_model("agents", "MCPTool")
    for tool in tool_model._base_manager.using(database).iterator():
        server_id = _legacy_id(tool.server_id, prefix="mcp_")
        tool.grant_id = f"{server_id}.{str(tool.name).strip()}"
        tool.save(update_fields=("grant_id",))


class Migration(migrations.Migration):
    """Give persisted MCPTool rows their stable catalogue key."""

    dependencies = [
        ("agents", "__latest__"),
        ("rebac", "__latest__"),
    ]
    operations = [
        migrations.AddField(
            model_name="mcptool",
            name="grant_id",
            field=models.CharField(blank=True, editable=False, max_length=260, null=True),
        ),
        migrations.RunPython(populate_grant_ids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="mcptool",
            name="grant_id",
            field=models.CharField(editable=False, max_length=260, unique=True),
        ),
    ]
