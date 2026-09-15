"""Index workflow step artifacts by their generic delivery target."""

from __future__ import annotations

from django.db import migrations, models
from django.db.migrations.state import ProjectState

_INDEX_NAME = "idx_war_target"


def applies(project_state: ProjectState) -> bool:
    """Apply only to a StepArtifact that is missing the target index."""

    artifact = project_state.models.get(("workflows", "stepartifact"))
    if artifact is None:
        return False
    installed = {index.name for index in artifact.options.get("indexes", ())}
    return _INDEX_NAME not in installed


class Migration(migrations.Migration):
    """Persist the composite index the artifact-delivery lookups filter on."""

    dependencies: list[tuple[str, str]] = []
    operations = [
        migrations.AddIndex(
            model_name="stepartifact",
            index=models.Index(
                fields=("target_content_type", "target_object_id"), name=_INDEX_NAME
            ),
        ),
    ]
