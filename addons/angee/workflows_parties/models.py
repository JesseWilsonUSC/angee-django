"""Workflow lifecycle contributions for native Party records."""

from __future__ import annotations

from django.db import models, transaction
from rebac import system_context

from angee.base.refs import canonical_record_target
from angee.workflows.states import RunStatus


class PartyHandle(models.Model):
    """Wake workflows retaining this exact association when its review changes."""

    extends = "parties.PartyHandle"

    class Meta:
        abstract = True

    def _deliver_artifact_runs_on_commit(self) -> None:
        target = canonical_record_target(self)
        run_model = self._meta.apps.get_model("workflows", "WorkflowRun")
        with system_context(reason="workflows_parties.party_handle.artifact_runs"):
            run_ids = tuple(
                run_model._base_manager.filter(
                    step_runs__attempts__artifacts__target_content_type=target.content_type,
                    step_runs__attempts__artifacts__target_object_id=target.object_id,
                )
                .exclude(status__in=RunStatus.TERMINAL)
                .order_by("pk")
                .values_list("pk", flat=True)
                .distinct()
            )

        def deliver() -> None:
            from angee.workflows import engine

            for run_id in run_ids:
                engine.deliver(run_id)

        transaction.on_commit(deliver)

    def confirm(self) -> None:
        """Confirm the association and notify exact artifact-linked workflows."""

        with transaction.atomic():
            super().confirm()
            self._deliver_artifact_runs_on_commit()

    def dismiss(self) -> None:
        """Dismiss the association and notify exact artifact-linked workflows."""

        with transaction.atomic():
            super().dismiss()
            self._deliver_artifact_runs_on_commit()
