import * as React from "react";
import {
  modelLabelSegment,
  type DataResourceGrantableRelation,
  type DataResourceSubjectSpecies,
} from "@angee/metadata";

import { DialogForm } from "../../fragments/DialogForm";
import { ErrorBanner } from "../../fragments/ErrorBanner";
import { LoadingPanel } from "../../fragments/LoadingPanel";
import { useUiT } from "../../i18n";
import { ControlBandProvider } from "../../layouts/ControlBand";
import { Button } from "../../ui/button";
import { FieldLabel, FieldRoot } from "../../ui/field";
import { Select } from "../../ui/select";
import { SubjectPicker } from "./SubjectPicker";
import { defineRowAction } from "../resource/RowActions";
import { RowsListView } from "../resource/RowsListView";

/** Presentation contract; the contributing addon owns its typed API adapter. */
export type RecordAccessEntry = {
  id: string;
  targetId: string;
  relation: string;
  subject: string;
  subjectType: string;
  label: string;
};

export interface ManageAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactElement;
  label: string;
  targetIds: readonly string[];
  grantable: readonly DataResourceGrantableRelation[];
  entries: readonly RecordAccessEntry[];
  fetching: boolean;
  error: Error | null;
  onRetry: () => void;
  onGrant: (relation: string, subject: string) => Promise<boolean>;
  onRevoke: (entry: RecordAccessEntry) => Promise<void>;
}

/** Direct access for one record or a selection, over the shared collection owners. */
export function ManageAccessDialog(props: ManageAccessDialogProps): React.ReactElement {
  const t = useUiT();
  return (
    <DialogForm
      open={props.open}
      onOpenChange={props.onOpenChange}
      trigger={props.trigger}
      title={t("access.title", { label: props.label })}
      description={t("access.directOnly")}
      size="lg"
    >
      {props.open ? <AccessContents {...props} /> : null}
    </DialogForm>
  );
}

function AccessContents({
  targetIds, grantable, entries, fetching, error, onRetry, onGrant, onRevoke,
}: ManageAccessDialogProps): React.ReactElement {
  const t = useUiT();
  const [relationName, setRelationName] = React.useState(grantable[0]?.relation ?? "");
  const [speciesKey, setSpeciesKey] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [pickerRevision, setPickerRevision] = React.useState(0);
  const [pending, setPending] = React.useState(false);
  const relation = grantable.find((item) => item.relation === relationName) ?? grantable[0];
  const species = relation?.subjects.filter(
    (item): item is DataResourceSubjectSpecies & { resource: string } => Boolean(item.resource),
  ) ?? [];
  const selectedSpecies = species.find((item) => subjectSpeciesKey(item) === speciesKey) ?? species[0];
  const relationLabelId = React.useId();
  const speciesLabelId = React.useId();
  const rowActions = React.useMemo(() => [defineRowAction<RecordAccessEntry>({
    kind: "page",
    id: "revoke",
    label: t("access.remove"),
    icon: "x",
    variant: "ghost",
    pendingPolicy: "disable-actions",
    disabled: () => pending || fetching,
    onSelect: async (entry) => {
      setPending(true);
      try {
        await onRevoke(entry);
      } finally {
        setPending(false);
      }
    },
  })], [fetching, onRevoke, pending, t]);
  const columns = React.useMemo(() => [
    { field: "label", header: t("access.recipient") },
    { field: "relation", header: t("access.relation") },
    ...(targetIds.length > 1 ? [{ field: "targetId", header: t("access.record") }] : []),
  ], [t, targetIds.length]);

  return (
    <ControlBandProvider host={undefined}>
      <ErrorBanner description={error?.message ?? null} actions={error ? (
        <Button size="sm" onClick={onRetry}>{t("collection.retry")}</Button>
      ) : undefined} />
      {fetching && entries.length === 0 ? <LoadingPanel density="inline" /> : null}
      <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldRoot>
              <FieldLabel id={relationLabelId} nativeLabel={false} render={<span />}>
                {t("access.relation")}
              </FieldLabel>
              <Select
                aria-labelledby={relationLabelId}
                value={relation?.relation ?? ""}
                disabled={pending || fetching || Boolean(error)}
                options={grantable.map((item) => ({ value: item.relation, label: item.relation }))}
                onValueChange={(value) => { setRelationName(value ?? ""); setSpeciesKey(""); setSubject(""); }}
              />
            </FieldRoot>
            <FieldRoot>
              <FieldLabel id={speciesLabelId} nativeLabel={false} render={<span />}>
                {t("access.recipientType")}
              </FieldLabel>
              <Select
                aria-labelledby={speciesLabelId}
                value={selectedSpecies ? subjectSpeciesKey(selectedSpecies) : ""}
                disabled={pending || fetching || Boolean(error) || species.length === 0}
                options={species.map((item) => ({
                  value: subjectSpeciesKey(item),
                  label: `${modelLabelSegment(item.resource)}${item.relation ? ` (${item.relation})` : ""}`,
                }))}
                onValueChange={(value) => { setSpeciesKey(value ?? ""); setSubject(""); }}
              />
            </FieldRoot>
          </div>
          {selectedSpecies ? <SubjectPicker
            key={`${relation?.relation}:${subjectSpeciesKey(selectedSpecies)}:${pickerRevision}`}
            resource={selectedSpecies.resource}
            value={subject}
            aria-label={t("access.recipient")}
            readOnly={pending || fetching || Boolean(error)}
            onChange={setSubject}
          /> : null}
          <Button
            type="button" variant="primary" size="sm"
            disabled={pending || fetching || Boolean(error) || !subject || !relation || targetIds.length === 0}
            onClick={async () => {
              if (!relation || !subject) return;
              setPending(true);
              try {
                if (await onGrant(relation.relation, subject)) {
                  setSubject("");
                  setPickerRevision((value) => value + 1);
                }
              } finally {
                setPending(false);
              }
            }}
          >{t("access.add")}</Button>
        </div>
      {!error ? <RowsListView
        scope="local"
        presentation="embedded"
        rows={entries}
        fetching={fetching}
        columns={columns}
        rowActions={rowActions}
        emptyContent={t("access.empty")}
      /> : null}
    </ControlBandProvider>
  );
}

function subjectSpeciesKey(species: DataResourceSubjectSpecies): string {
  return `${species.type}#${species.relation ?? ""}`;
}
