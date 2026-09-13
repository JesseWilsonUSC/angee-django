import * as React from "react";
import { useAuthoredQuery } from "@angee/refine";
import {
  Column,
  EmptyState,
  ErrorBanner,
  Field,
  Form,
  List,
  LoadingPanel,
  ResourceList,
  errorMessage,
  useT,
  type RecordPanelContext,
  type RecordTabDescriptor,
} from "@angee/ui";

import { ExtractionRecordEvidenceDocument } from "./documents";
import { ExtractionEvidenceDetails } from "./ExtractionEvidenceDetails";

const EXTRACTION_MODEL = "workflows_ocr.Extraction";

function ExtractionEvidencePanel({ recordId }: RecordPanelContext): React.ReactElement {
  const t = useT("workflowsOcr");
  const query = useAuthoredQuery(
    ExtractionRecordEvidenceDocument,
    { id: recordId },
    { models: [EXTRACTION_MODEL] },
  );
  const evidence = query.data?.extraction_evidence;
  if (query.isFetching && !evidence) return <LoadingPanel message={t("loading")} />;
  if (query.error) return <ErrorBanner description={errorMessage(query.error, t("unavailable"))} />;
  if (!evidence) return <EmptyState icon="workflow-run" title={t("unavailable")} />;
  return <ExtractionEvidenceDetails evidence={evidence} />;
}

const RECORD_TABS: readonly RecordTabDescriptor[] = [{
  id: "evidence",
  label: "Evidence",
  render: (context) => <ExtractionEvidencePanel {...context} />,
}];

export function ExtractionsPage(): React.ReactElement {
  return <ResourceList resource={EXTRACTION_MODEL} placement="inline" routed hideCreate recordTabs={RECORD_TABS} defaultRecordTab="evidence">
    <List resource={EXTRACTION_MODEL}>
      <Column field="revision" />
      <Column field="status" />
      <Column field="schema_id" />
      <Column field="engine" />
      <Column field="created_at" />
    </List>
    <Form resource={EXTRACTION_MODEL}>
      <Field name="revision" readOnly title />
      <Field name="status" readOnly />
      <Field name="error_code" readOnly />
      <Field name="schema_id" readOnly />
      <Field name="schema_digest" readOnly />
      <Field name="engine" readOnly />
      <Field name="model" readOnly />
      <Field name="recognition_model" readOnly />
      <Field name="created_at" readOnly />
    </Form>
  </ResourceList>;
}
