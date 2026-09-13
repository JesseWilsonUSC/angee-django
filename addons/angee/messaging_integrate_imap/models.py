"""Explicit historical sample actions on the canonical Messaging Channel."""

from __future__ import annotations

from datetime import date
from typing import Any

from django.apps import apps
from django.core.exceptions import ValidationError
from django.db import models, transaction
from rebac import actor_context, system_context

from angee.integrate.locks import bridge_advisory_lock
from angee.messaging_integrate_imap.backend import (
    ImapChannelBackend,
    ImapSampleImport,
    ImapSamplePreview,
)
from angee.messaging_integrate_imap.parser import EMBEDDED_MESSAGE_MAX_BYTES, expand_embedded_message


class ImapChannelSampling(models.Model):
    """Compose bounded imports without a second channel, cursor or intake ledger."""

    extends = "messaging.Channel"

    class Meta:
        abstract = True

    def _require_imap_sampling(self, actor: Any) -> None:
        """Sampling needs explicit channel write access and a paused IMAP bridge."""

        self.with_actor(actor)._require_record_access("write")
        if self.lifecycle != self.Lifecycle.PAUSED:
            raise ValidationError("Pause this channel before selecting historical messages.")
        if not isinstance(self.backend, ImapChannelBackend):
            raise ValidationError("Historical mailbox selection is available for IMAP channels.")

    def preview_imap_sample(
        self, *, actor: Any, mailbox: str, since: date, before: date, limit: int = 20,
    ) -> ImapSamplePreview:
        """Read a bounded header preview; leave the mailbox and normal cursor unchanged."""

        current = type(self)._base_manager.get(pk=self.pk)
        current._require_imap_sampling(actor)
        return current.backend.preview_sample(mailbox=mailbox, since=since, before=before, limit=limit)

    def import_imap_sample(
        self, *, actor: Any, mailbox: str, uidvalidity: int, uids: list[int],
    ) -> ImapSampleImport:
        """Land selected messages as historical records with native live events suppressed.

        The shared bridge lock excludes normal sync. Network retrieval precedes
        the local transaction; paused state, access and transport configuration
        are rechecked before landing. Messaging owns idempotency and provenance.
        Neither this operation nor the backend writes the regular bridge cursor.
        """

        current = type(self)._base_manager.get(pk=self.pk)
        current._require_imap_sampling(actor)
        with bridge_advisory_lock(current) as acquired:
            if not acquired:
                raise ValidationError("The channel is busy. Retry when its current operation finishes.")
            parsed, imported_uids, flags_unchanged = current.backend.fetch_sample(
                mailbox=mailbox, uidvalidity=uidvalidity, uids=uids,
            )
            with transaction.atomic():
                locked = type(self)._base_manager.select_for_update().get(pk=self.pk)
                locked._require_imap_sampling(actor)
                if locked.config != current.config or locked.credential_id != current.credential_id:
                    raise ValidationError("The channel configuration changed. Preview the sample again.")
                with system_context(reason="messaging_integrate_imap.historical_sample"):
                    messages = apps.get_model("messaging", "Message").objects.ingest(
                        parsed, channel=locked, historical=True,
                    )
            return ImapSampleImport(
                message_ids=[str(message.sqid) for message in messages],
                requested_uids=sorted(uids), imported_uids=imported_uids,
                missing_uids=sorted(set(uids) - set(imported_uids)), flags_unchanged=flags_unchanged,
            )

    def expand_retained_imap_part(self, part: Any, *, actor: Any) -> tuple[Any, ...]:
        """Append bounded evidence below this Channel's retained RFC 822 Part.

        Existing Message, Part and File identities remain unchanged. The IMAP
        adapter owns RFC 822 decoding; Messaging owns the locked, idempotent
        descendant write.
        """

        with actor_context(actor):
            current = type(self)._base_manager.get(pk=self.pk)
            current._require_record_access("write")
            part_model = apps.get_model("messaging", "Part")
            if not isinstance(part, part_model) or part.pk is None:
                raise ValidationError("Embedded expansion requires a retained Message Part.")
            retained = part_model._base_manager.select_related("message", "file").get(pk=part.pk)
            if (retained.message.channel_id != current.pk or str(retained.type).lower() != "message/rfc822"
                    or retained.file_id is None):
                raise ValidationError("Select an RFC 822 Part retained by this IMAP Channel.")
            retained.file._require_record_access("read")
            with retained.file.open_stream() as stream:
                raw = stream.read(EMBEDDED_MESSAGE_MAX_BYTES + 1)
            child = expand_embedded_message(raw)
            if child is None:
                return ()
            return apps.get_model("messaging", "Message").objects.expand_retained_part(
                retained, (child,),
            )
