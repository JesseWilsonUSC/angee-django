import * as React from "react";
import {
  Badge,
  FormRoot,
  RelationPicker,
  TextLink,
  useRelationOptions,
  useResourceRecordHrefLookup,
  useRouteHref,
  type RelationOption,
} from "@angee/ui";

import { useWorkflowsT } from "./i18n";
import { publicationLabel } from "./publication";

export interface WorkflowHeadPickerProps {
  value?: string | null;
  onChange: (value: string) => void;
  label: React.ReactNode;
  subjectDeclaration?: string;
  readOnly?: boolean;
}

/** Actor-scoped workflow-lineage selection with visible publication state. */
export function WorkflowHeadPicker({ value, onChange, label, subjectDeclaration, readOnly }: WorkflowHeadPickerProps): React.ReactElement {
  const t = useWorkflowsT();
  const labelId = React.useId();
  const recordHref = useResourceRecordHrefLookup();
  const routeHref = useRouteHref();
  const filters = React.useMemo(() => [
    { field: "published_from", operator: "null" as const, value: true },
    ...(subjectDeclaration ? [{ field: "subject_declaration", operator: "eq" as const, value: subjectDeclaration }] : []),
  ], [subjectDeclaration]);
  const workflows = useRelationOptions({ resource: "workflows.Workflow", labelField: "name", canCreate: false }, {
    fields: ["publication_status", "current_published_version", "subject_declaration"], filters,
  });
  const selected = workflows.rows.find((row) => row.id === value);
  const options = React.useMemo<readonly RelationOption[]>(() => workflows.rows.map((row) => ({
    value: String(row.id), label: `${String(row.name ?? row.id)} · ${publicationLabel({
      id: String(row.id), publication_status: row.publication_status,
      current_published_version: row.current_published_version,
    }, t)}`,
  })), [t, workflows.rows]);
  const selectedHref = value ? recordHref("workflows.Workflow", value) : undefined;

  return <FormRoot.Field label={label} labelProps={{ id: labelId }}>
    <div className="flex flex-wrap items-center gap-2">
      <RelationPicker aria-labelledby={labelId} value={value} options={options} readOnly={readOnly} onChange={onChange} />
      {selected ? <Badge tone={selected.publication_status === "published" ? "success" : "warning"}>{publicationLabel({
        id: String(selected.id), publication_status: selected.publication_status,
        current_published_version: selected.current_published_version,
      }, t)}</Badge> : null}
      {selectedHref ? <TextLink href={selectedHref}>{t("action.edit")}</TextLink>
        : <TextLink href={routeHref("workflows.workflows")}>{t("action.create")}</TextLink>}
    </div>
  </FormRoot.Field>;
}
