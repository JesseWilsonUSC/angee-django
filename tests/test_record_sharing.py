"""Focused contracts for the generic direct record-sharing surface."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from django.core.exceptions import ValidationError
from rebac import SubjectRef

from angee.graphql import sharing
from angee.graphql.sharing import RecordAccessType
from angee.storage.models import Drive
from angee.workflows.models import Workflow


def test_group_access_projects_canonical_subject_identity() -> None:
    access = SimpleNamespace(
        relation="viewer",
        subject=SubjectRef.of("auth/group", "42", "member"),
    )

    projected = RecordAccessType.from_direct("row_1", access, "Reviewers")

    assert projected.target_id == "row_1"
    assert projected.subject == "auth/group:42#member"
    assert projected.subject_type == "auth/group"
    assert projected.label == "Reviewers"


def test_share_declarations_and_lineage_head_guard() -> None:
    assert Drive.get_rebac_grantable() == {"editor": "write", "viewer": "write"}
    assert Workflow.get_rebac_grantable() == {"editor": "write", "viewer": "write"}
    Workflow.validate_record_access_target(SimpleNamespace(published_from_id=None))
    with pytest.raises(ValidationError, match="lineage head"):
        Workflow.validate_record_access_target(SimpleNamespace(published_from_id=7))


def test_relation_options_are_authorized_independently(monkeypatch: pytest.MonkeyPatch) -> None:
    target = SimpleNamespace(validate_record_access_target=lambda: None)

    class ShareModel:
        @classmethod
        def get_rebac_grantable(cls) -> dict[str, str]:
            return {"viewer": "share", "editor": "admin"}

    def authorize(_info: Any, _model: Any, _id: Any, permission: str) -> Any:
        if permission == "admin":
            raise ValidationError("denied")
        return target

    monkeypatch.setattr(sharing, "authorized_permission_target", authorize)

    resolved, allowed = sharing._authorized_record_access(None, ShareModel, "row_1")

    assert resolved is target
    assert allowed == ["viewer"]


@pytest.mark.parametrize(
    "subject",
    (SubjectRef.of("angee/role", "admin", "member"), SubjectRef.of("auth/user", "*")),
)
def test_legacy_or_wildcard_subjects_remain_visible(subject: SubjectRef) -> None:
    projected = RecordAccessType.from_direct(
        "row_1",
        SimpleNamespace(relation="viewer", subject=subject),
        str(subject),
    )

    assert projected.subject == str(subject)
    assert projected.subject_type == subject.subject_type
