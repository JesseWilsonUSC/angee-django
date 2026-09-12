"""Allow install resources to own integrations without a fake user principal."""

from __future__ import annotations

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import migrations, models
from django.db.migrations.state import ProjectState


def applies(project_state: ProjectState) -> bool:
    """Apply only while Integration.owner is still required."""

    model = project_state.models.get(("integrate", "integration"))
    if model is None:
        return False
    field = model.fields.get("owner")
    if field is None:
        raise ImproperlyConfigured("angee.integrate:platform_managed_integrations found no owner field")
    return not field.null


class Migration(migrations.Migration):
    dependencies: list[tuple[str, str]] = []
    operations = [
        migrations.AlterField(
            model_name="integration",
            name="owner",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.CASCADE,
                related_name="integrations",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
