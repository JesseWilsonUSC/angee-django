"""Focused contracts for the generic direct record-sharing surface."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from django.core.exceptions import ValidationError

from angee.graphql import sharing
from angee.graphql.sharing import RecordAccessType, _require_shareable_head
from angee.iam.schema import GROUP_PUBLIC_IDENTITY
from angee.storage.models import Drive
from angee.workflows.models import Workflow
from rebac import SubjectRef


def test_supported_group_access_projects_a_public_recipient() -> None:
    access = SimpleNamespace(
        relation="viewer",
        subject=SubjectRef.of("auth/group", "42", "member"),
    )

    projected = RecordAccessType.from_direct(access)

    assert projected.recipient is not None
    assert projected.recipient.target_type == "auth/group"
    assert projected.recipient.target_id == GROUP_PUBLIC_IDENTITY.public_id_from_pk(42)


def test_share_declarations_and_lineage_head_guard() -> None:
    assert Drive.get_rebac_grantable() == {"editor": "write", "viewer": "write"}
    assert Workflow.get_rebac_grantable() == {"editor": "write", "viewer": "write"}
    _require_shareable_head(SimpleNamespace(published_from_id=None))
    with pytest.raises(ValueError, match="lineage head"):
        _require_shareable_head(SimpleNamespace(published_from_id=7))


def test_relation_options_are_authorized_independently(monkeypatch: pytest.MonkeyPatch) -> None:
    target = SimpleNamespace(published_from_id=None)

    class ShareModel:
        @classmethod
        def get_rebac_grantable(cls) -> dict[str, str]:
            return {"viewer": "share", "editor": "admin"}

    def authorize(_info: Any, _model: Any, _id: Any, permission: str) -> Any:
        if permission == "admin":
            raise ValidationError("denied")
        return target

    monkeypatch.setattr(sharing, "authorized_action_target", authorize)

    resolved, allowed = sharing._authorized_record_access(None, ShareModel, "row_1")

    assert resolved is target
    assert allowed == ["viewer"]


@pytest.mark.parametrize(
    "subject",
    (SubjectRef.of("angee/role", "admin", "member"), SubjectRef.of("auth/user", "*")),
)
def test_legacy_or_wildcard_subjects_remain_read_only(subject: SubjectRef) -> None:
    projected = RecordAccessType.from_direct(SimpleNamespace(relation="viewer", subject=subject))

    assert projected.subject == str(subject)
    assert projected.recipient is None
