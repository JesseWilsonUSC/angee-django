"""Workflow lifecycle contributions for native Party records."""

from __future__ import annotations

from django.db import models, transaction


class PartyHandle(models.Model):
    """Wake workflows retaining this exact association when its review changes."""

    extends = "parties.PartyHandle"

    class Meta:
        abstract = True

    def _deliver_artifact_runs_on_commit(self) -> None:
        from angee.workflows import engine

        transaction.on_commit(lambda: engine.deliver_artifact(self))

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
