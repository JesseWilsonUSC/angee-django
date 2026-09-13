"""Remove the roster snapshot after roster and thread reach become live-backed."""

from django.core.exceptions import ImproperlyConfigured
from django.db import migrations
from django.db.migrations.state import ProjectState


def applies(project_state: ProjectState) -> bool:
    """Apply to the exact snapshot-backed roster after Thread.groups exists."""

    membership = project_state.models.get(("spaces", "membership"))
    thread = project_state.models.get(("messaging", "thread"))
    if membership is None and thread is None:
        return False
    if membership is None or thread is None:
        raise ImproperlyConfigured(
            "angee.spaces:live_relation_backing found only part of its composed model state"
        )
    has_snapshot = "granted_user" in membership.fields
    if not has_snapshot:
        if not {"group", "party", "role"}.issubset(membership.fields):
            raise ImproperlyConfigured(
                "angee.spaces:live_relation_backing found an unexpected current Membership state"
            )
        if "groups" in thread.fields and "group" not in thread.fields:
            return False
        raise ImproperlyConfigured(
            "angee.spaces:live_relation_backing found an unexpected current Thread state"
        )
    required_membership = {"group", "party", "role", "granted_user"}
    if not required_membership.issubset(membership.fields):
        raise ImproperlyConfigured(
            "angee.spaces:live_relation_backing found a partial Membership mirror state"
        )
    if "groups" in thread.fields and "group" not in thread.fields:
        return True
    if "group" in thread.fields and "groups" not in thread.fields:
        return False
    raise ImproperlyConfigured(
        "angee.spaces:live_relation_backing found an unexpected messaging.Thread group state"
    )


class Migration(migrations.Migration):
    """Remove the obsolete derived-grantee snapshot column."""

    dependencies = [
        ("spaces", "__latest__"),
        ("messaging", "__latest__"),
        ("rebac", "__latest__"),
    ]
    operations = [
        migrations.RemoveField(model_name="membership", name="granted_user"),
    ]
