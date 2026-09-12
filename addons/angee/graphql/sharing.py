"""Declarative GraphQL surface for direct record sharing."""

from __future__ import annotations

from typing import Any

import strawberry
from angee.base.identity import instance_from_public_id, public_id_for
from angee.base.models import AngeeModel, DirectRecordAccess
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError
from rebac import ObjectRef, PermissionDenied, SubjectRef
from rebac.resources import model_for_resource_type

from angee.graphql.actions import ActionResult, action_guard, authorized_permission_target
from angee.graphql.ids import PublicID


@strawberry.type
class RecordAccessType:
    """One stored direct relation on a record's declared share surface."""

    relation: str
    subject: str
    recipient: RecordAccessRecipientType | None

    @classmethod
    def from_direct(cls, access: DirectRecordAccess) -> RecordAccessType:
        """Project one model-owned direct tuple onto the GraphQL boundary."""

        subject = access.subject
        recipient: RecordAccessRecipientType | None = None
        if subject.subject_type == "auth/user" and not subject.optional_relation and subject.subject_id != "*":
            try:
                recipient = RecordAccessRecipientType(
                    target_type="auth/user",
                    target_id=PublicID(public_id_for(get_user_model(), subject.subject_id)),
                )
            except (TypeError, ValueError):
                recipient = None
        elif (
            subject.subject_type == "auth/group"
            and subject.optional_relation == "member"
            and subject.subject_id != "*"
        ):
            from angee.iam.schema import GROUP_PUBLIC_IDENTITY

            try:
                recipient = RecordAccessRecipientType(
                    target_type="auth/group",
                    target_id=PublicID(GROUP_PUBLIC_IDENTITY.public_id_from_pk(subject.subject_id)),
                )
            except (TypeError, ValueError):
                recipient = None
        return cls(relation=access.relation, subject=str(subject), recipient=recipient)


@strawberry.type
class RecordAccessOption:
    """One direct relation the caller may manage on the target record."""

    relation: str
    permission: str


@strawberry.type
class RecordAccessRecipientType:
    """Public identity of an existing supported access recipient."""

    target_type: str
    target_id: PublicID


@strawberry.input
class RecordAccessRecipientInput:
    """Public identity of a supported direct-access recipient."""

    target_type: str
    target_id: PublicID


@strawberry.type
class RecordAccessQuery:
    """Direct-access listing for one declaratively shareable record."""

    @strawberry.field
    def record_access(
        self,
        info: strawberry.Info,
        target_type: str,
        target_id: PublicID,
    ) -> list[RecordAccessType]:
        """Return direct declared-relation tuples, without effective expansion."""

        model = _shareable_model(target_type)
        target, allowed = _authorized_record_access(info, model, target_id)
        return [
            RecordAccessType.from_direct(access)
            for access in target.direct_record_access(allowed)
        ]

    @strawberry.field
    def record_access_options(
        self,
        info: strawberry.Info,
        target_type: str,
        target_id: PublicID,
    ) -> list[RecordAccessOption]:
        """Return declared relations the caller may manage on this record."""

        model = _shareable_model(target_type)
        _target, allowed = _authorized_record_access(info, model, target_id)
        declaration = model.get_rebac_grantable()
        return [RecordAccessOption(relation=relation, permission=declaration[relation]) for relation in allowed]


@strawberry.type
class RecordAccessMutation:
    """Authored grant and revoke actions for declared record relations."""

    @strawberry.mutation
    @action_guard("Grant record access failed.")
    def grant_record_access(
        self,
        info: strawberry.Info,
        target_type: str,
        target_id: PublicID,
        relation: str,
        recipient: RecordAccessRecipientInput,
    ) -> ActionResult:
        """Idempotently grant a user or group one declared target relation."""

        model = _shareable_model(target_type)
        permission = model.record_access_permission(relation)
        target = authorized_permission_target(info, model, target_id, permission)
        target.grant_record_access(relation, _recipient_subject(recipient))
        return ActionResult(ok=True, message="Record access granted.")

    @strawberry.mutation
    @action_guard("Revoke record access failed.")
    def revoke_record_access(
        self,
        info: strawberry.Info,
        target_type: str,
        target_id: PublicID,
        relation: str,
        recipient: RecordAccessRecipientInput,
    ) -> ActionResult:
        """Idempotently revoke a user or group from one target relation."""

        model = _shareable_model(target_type)
        permission = model.record_access_permission(relation)
        target = authorized_permission_target(info, model, target_id, permission)
        target.revoke_record_access(relation, _recipient_subject(recipient))
        return ActionResult(ok=True, message="Record access revoked.")


def _shareable_model(target_type: str) -> type[AngeeModel]:
    """Resolve one declared Angee record model from its REBAC resource type."""

    model = model_for_resource_type(target_type)
    if model is None or not issubclass(model, AngeeModel):
        raise ValueError(f"Record target type {target_type!r} is not shareable.")
    return model


def _subject_user(subject: PublicID) -> Any:
    """Resolve the recipient user through Angee's public-id path."""

    user = instance_from_public_id(get_user_model(), str(subject))
    if user is None:
        raise ValueError(f"User {str(subject)!r} was not found.")
    return user


def _recipient_subject(recipient: RecordAccessRecipientInput) -> Any:
    """Resolve an allowlisted public recipient to its canonical REBAC subject."""

    if recipient.target_type == "auth/user":
        return _subject_user(recipient.target_id)
    if recipient.target_type == "auth/group":
        from angee.iam.schema import GROUP_PUBLIC_IDENTITY

        group = instance_from_public_id(
            Group,
            str(recipient.target_id),
            public_identity=GROUP_PUBLIC_IDENTITY,
        )
        if group is None:
            raise ValueError(f"Group {str(recipient.target_id)!r} was not found.")
        return SubjectRef(ObjectRef("auth/group", str(group.pk)), "member")
    raise ValueError(f"Recipient type {recipient.target_type!r} is not supported.")


def _authorized_record_access(
    info: strawberry.Info,
    model: type[AngeeModel],
    target_id: PublicID,
) -> tuple[AngeeModel, list[str]]:
    """Resolve a target and independently authorize each declared share relation."""

    declaration = model.get_rebac_grantable()
    if not declaration:
        raise ValueError(f"{model._meta.label} declares no grantable relations.")
    target: AngeeModel | None = None
    allowed: list[str] = []
    candidates: dict[str, AngeeModel] = {}
    for permission in dict.fromkeys(declaration.values()):
        try:
            candidates[permission] = authorized_permission_target(info, model, target_id, permission)
        except (PermissionDenied, ValidationError):
            continue
    for relation, permission in declaration.items():
        if permission in candidates:
            target = candidates[permission]
            allowed.append(relation)
    if target is None:
        # Preserve the native authorization error shape without exposing target existence.
        target = authorized_permission_target(info, model, target_id, next(iter(declaration.values())))
    target.validate_record_access_target()
    return target, allowed


schemas = {
    "console": {
        "query": [RecordAccessQuery],
        "mutation": [RecordAccessMutation],
        "types": [RecordAccessType, RecordAccessOption, RecordAccessRecipientType, RecordAccessRecipientInput],
    }
}
"""Direct record-sharing contributions to the console schema."""
