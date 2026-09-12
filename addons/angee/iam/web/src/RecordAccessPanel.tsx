import { useModelMetadata } from "@angee/metadata";
import { extractActionOutcome, useAuthoredMutation, useAuthoredQuery } from "@angee/refine";
import {
  ActionFormDialog, Button, ErrorBanner, RowsListView, defineRowAction,
  type ActionDescriptor,
} from "@angee/ui";
import { useMemo, useState, type ReactElement } from "react";

import { useAssignmentSubjects } from "./assignment-subjects";
import { IamGrantRecordAccess, IamRecordAccess, IamRevokeRecordAccess } from "./record-access/documents";
import { titleLabel } from "./identity-labels";
import { useIamT } from "./i18n";

/** Edit the target owner's declared direct grants, using IAM's typed recipients. */
export function RecordAccessPanel({ resource, recordId, recordLabel }: {
  resource: string; recordId: string; recordLabel: string;
}): ReactElement {
  const metadata = useModelMetadata(resource);
  const t = useIamT();
  const targetType = metadata?.resource.resourceType;
  if (!targetType) return <ErrorBanner description={t("recordAccess.unavailable")} />;
  return <TargetRecordAccessPanel key={`${targetType}:${recordId}`} targetType={targetType}
    recordId={recordId} recordLabel={recordLabel} resource={resource} />;
}

function TargetRecordAccessPanel({ targetType, recordId, recordLabel, resource }: {
  targetType: string; recordId: string; recordLabel: string; resource: string;
}): ReactElement {
  const t = useIamT();
  const [open, setOpen] = useState(false);
  const target = useMemo(() => ({ targetType, targetId: recordId }), [targetType, recordId]);
  const query = useAuthoredQuery(IamRecordAccess, target, { models: [resource] });
  const subjects = useAssignmentSubjects();
  const [grant] = useAuthoredMutation(IamGrantRecordAccess, { invalidateModels: [resource] });
  const rows = (query.data?.record_access ?? []).map((row) => ({
    ...row, id: `${row.relation}:${row.subject}`,
    label: subjects.options.find((option) => option.value === row.subject)?.label ?? row.subject,
  }));
  const action = useMemo<ActionDescriptor>(() => ({
    id: "grant-record-access", label: t("recordAccess.grant"),
    args: [
      { name: "subject", widget: "select", label: t("recordAccess.recipient"), options: subjects.options },
      { name: "relation", widget: "select", label: t("recordAccess.role"),
        options: (query.data?.record_access_options ?? []).map((option) => ({
          value: option.relation, label: titleLabel(option.relation),
        })) },
    ],
    submit: async (values) => {
      const recipient = subjects.options.find((option) => option.value === values.subject);
      if (!recipient) return { ok: false, message: t("recordAccess.chooseRecipient") };
      const outcome = extractActionOutcome(await grant({ ...target, relation: String(values.relation),
        recipient: { target_type: recipient.kind === "user" ? "auth/user" : "auth/group", target_id: recipient.id },
      }), "grant_record_access") ?? { ok: false, message: t("recordAccess.failed") };
      if (outcome.ok) await query.refetch();
      return outcome;
    },
  }), [grant, query.data?.record_access_options, query.refetch, subjects.options, t, target]);

  return <div className="space-y-3">
    <p className="text-13 text-fg-muted">{t("recordAccess.description", { target: recordLabel })}</p>
    {subjects.error ? <ErrorBanner description={t("recordAccess.recipientsUnavailable")} /> : null}
    <RowsListView scope="local" rows={rows} fetching={query.isFetching} error={query.error}
      columns={[
        { field: "label", header: t("recordAccess.recipient") },
        { field: "relation", header: t("recordAccess.role"), render: (row) => titleLabel(row.relation) },
      ]}
      toolbarActions={<Button type="button" size="sm" onClick={() => setOpen(true)}
        disabled={!query.data?.record_access_options.length || subjects.isFetching || Boolean(subjects.error)}>
        {t("recordAccess.grant")}
      </Button>}
      rowActions={[defineRowAction({
        kind: "authored", id: "revoke-record-access", label: t("revoke"), variant: "danger",
        document: IamRevokeRecordAccess,
        variables: (row: (typeof rows)[number]) => ({ ...target, relation: row.relation,
          recipient: { target_type: row.recipient!.target_type, target_id: row.recipient!.target_id } }),
        visible: (row: (typeof rows)[number]) => Boolean(row.recipient),
        succeeded: (data) => data?.revoke_record_access.ok === true,
        invalidateModels: [resource],
        pendingPolicy: "active-row",
        toast: { title: () => t("recordAccess.revokeTitle"), description: () => t("recordAccess.failed") },
        confirm: { title: () => t("recordAccess.revokeTitle"),
          confirm: () => t("revoke"),
          body: (row: (typeof rows)[number]) => t("recordAccess.revokeBody", { role: titleLabel(row.relation), recipient: row.label, target: recordLabel }) },
      })]} />
    {open ? <ActionFormDialog action={action} context={{ record: { id: recordId, display_name: recordLabel }, selectedIds: [] }} open onOpenChange={setOpen} /> : null}
  </div>;
}
