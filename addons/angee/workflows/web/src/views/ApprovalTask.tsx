import * as React from "react";
import { useAuthoredMutation, type DocumentVariables } from "@angee/refine";
import {
  Badge, Button, Collapsible, ErrorBanner, FieldDescription, FieldLabel, FieldRoot,
  Glyph, JsonEditor, JsonValueView, LabeledDescriptorField, LazyBoundary, TextLink, formSpecInitialValues,
  PageAside,
  errorMessage, statusTone, useDottedPathFieldErrors, useFormSpecFields, useResourceRecordHrefLookup, useRouteHref, validationErrorMap,
  useModelSlot,
  useRecordPeek,
  type DottedPathFieldErrorMap, type FormSpecFieldDescriptor, type RecordPeekReference,
} from "@angee/ui";
import { useNavigate } from "@tanstack/react-router";
import { decisionHref } from "../decision-navigation";
import { DecideWorkflowDecisionDocument, type PendingWorkflowDecision } from "../documents.public";
import { useWorkflowsT } from "../i18n";
import { WORKFLOW_DECISION_CONTENT_SLOT } from "../slots";

const DECISION_MODEL = "workflows.Decision";
export type ApprovalVerdict = DocumentVariables<typeof DecideWorkflowDecisionDocument>["verdict"];
export type WorkflowDecisionRecordReference = RecordPeekReference;
export interface WorkflowDecisionContentProps {
  approval: PendingWorkflowDecision;
  contextFields: readonly FormSpecFieldDescriptor[];
  contextValues: Readonly<Record<string, unknown>>;
  inputFields: readonly FormSpecFieldDescriptor[];
  values: Readonly<Record<string, unknown>>;
  setValue: (name: string, value: unknown) => void;
  messagesFor: (name: string) => readonly string[];
  resolve: (verdict: ApprovalVerdict, values?: Readonly<Record<string, unknown>>) => Promise<void>;
  editable: boolean;
  fetching: boolean;
  readOnly: boolean;
  openRecord?: (reference: WorkflowDecisionRecordReference) => void;
  openEvidence?: (reference: WorkflowDecisionRecordReference) => void;
}
export interface ApprovalTaskProps {
  approval: PendingWorkflowDecision;
  available?: boolean;
  onBack?: () => void;
  onResolved: () => void;
  reconcile?: (decisionId: string) => Promise<PendingWorkflowDecision | null>;
  onDirtyChange?: (dirty: boolean) => void;
  onSkip?: () => void;
  onOpenRecord?: WorkflowDecisionContentProps["openRecord"];
  onOpenEvidence?: WorkflowDecisionContentProps["openEvidence"];
}

/** The workflow-owned approval task, shared by approval and run surfaces. */
export function ApprovalTask({ approval, available = true, onBack, onResolved, reconcile, onDirtyChange, onSkip, onOpenRecord, onOpenEvidence }: ApprovalTaskProps): React.ReactElement {
  const t = useWorkflowsT();
  const openRecord = useRecordPeek();
  const active = approval.verdict === "PENDING";
  const editable = active && available;
  React.useEffect(() => {
    if (!editable) onDirtyChange?.(false);
    return () => onDirtyChange?.(false);
  }, [approval.id, editable, onDirtyChange]);
  return (
    <PageAside collapse="never" gutter="compact" className="h-full w-full bg-sheet-1">
      <div className="space-y-4">
        {onBack || onSkip ? <div className="flex items-center justify-between gap-2">
          {onBack ? (
            <Button type="button" variant="ghost" onClick={onBack}>
              <Glyph name="chevron-left" />
              {t("inbox.back")}
            </Button>
          ) : <span />}
          {onSkip ? <Button type="button" variant="ghost" onClick={onSkip}>{t("inbox.skip")}<Glyph name="chevron-right" /></Button> : null}
        </div> : null}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-fg">{approval.step_name || approval.action}</h2>
              <p className="mt-1 text-13 text-fg-muted">
                {[approval.target_reference?.label, approval.workflow_name || t("inbox.workflowFallback")]
                  .filter(Boolean).join(" · ")}
              </p>
            </div>
            <Badge tone={statusTone(approval.verdict)}>{approval.verdict}</Badge>
          </div>
        </div>
        {!available ? <ErrorBanner description={t("inbox.decisionUnavailable")} />
          : !active ? <div className="space-y-1 text-sm text-fg-muted">
            <p>{t("inbox.decisionNoLongerPending")}</p>
            <p>{t("inbox.decisionResolvedBy", {
              actor: approval.resolved_by || t("inbox.unknownActor"),
              date: new Date(approval.updated_at).toLocaleString(),
            })}</p>
          </div> : null}
        {approval.decision_schema == null ? (
          <JsonApprovalResolution key={approval.id} approval={approval} active={active} editable={editable} onResolved={onResolved} reconcile={reconcile} onDirtyChange={onDirtyChange} />
        ) : (
          <LazyBoundary pending={null} fallback={<ErrorBanner description={t("inbox.invalidFormSpec")} />} resetKey={approval.id}>
            <FormSpecApprovalResolution key={approval.id} approval={approval} active={active} editable={editable} onResolved={onResolved} reconcile={reconcile} onDirtyChange={onDirtyChange} onOpenRecord={onOpenRecord ?? openRecord} onOpenEvidence={onOpenEvidence ?? openRecord} />
          </LazyBoundary>
        )}
        <Collapsible variant="section">
          <Collapsible.Trigger><Collapsible.Icon />{t("inbox.sourceData")}</Collapsible.Trigger>
          <Collapsible.Panel>
            <div className="mb-2 text-xs text-fg-muted">
              {t("inbox.sourceMetadata")}: {approval.action} · {approval.priority}
            </div>
            <JsonValueView value={approval.payload} />
          </Collapsible.Panel>
        </Collapsible>
        <DecisionSourceLinks approval={approval} />
        <DecisionTargetLink approval={approval} />
      </div>
    </PageAside>
  );
}

function DecisionTargetLink({ approval }: { approval: PendingWorkflowDecision }): React.ReactElement | null {
  const t = useWorkflowsT();
  const recordHref = useResourceRecordHrefLookup();
  const target = approval.target_reference;
  const base = target ? recordHref(target.model, target.id) : undefined;
  if (!base || !target) return null;
  const href = decisionHref(base, approval.id, target.tab ?? undefined);
  return <TextLink href={href}>{t("inbox.openTarget")}</TextLink>;
}

function DecisionSourceLinks({ approval }: { approval: PendingWorkflowDecision }): React.ReactElement {
  const t = useWorkflowsT();
  if (!approval.source_run_id) {
    return <div className="text-xs text-fg-muted">{t("inbox.sourceUnavailable")}</div>;
  }
  return <AvailableDecisionSourceLinks approval={approval} sourceRunId={approval.source_run_id} />;
}

function AvailableDecisionSourceLinks({ approval, sourceRunId }: { approval: PendingWorkflowDecision; sourceRunId: string }): React.ReactElement {
  const t = useWorkflowsT();
  const navigate = useNavigate();
  const routeHref = useRouteHref();
  const runHref = routeHref("workflows.run", { id: sourceRunId });
  const executionHref = approval.source_execution_id
    ? `${runHref}?execution=${encodeURIComponent(approval.source_execution_id)}`
    : null;
  const attemptHref = executionHref && approval.source_attempt_id
    ? `${executionHref}&attempt=${encodeURIComponent(approval.source_attempt_id)}`
    : null;
  return (
    <div className="flex flex-wrap gap-x-2 text-xs text-fg-muted">
      <TextLink href={runHref} onNavigate={(href) => { void navigate({ to: href }); }}>
        {t("inbox.openSourceRun")}
      </TextLink>
      {executionHref ? <TextLink href={executionHref} onNavigate={(href) => { void navigate({ to: href }); }}>{t("inbox.sourceExecution", { id: approval.source_execution_id ?? "" })}</TextLink> : null}
      {attemptHref ? <TextLink href={attemptHref} onNavigate={(href) => { void navigate({ to: href }); }}>{t("inbox.sourceAttempt", { id: approval.source_attempt_id ?? "" })}</TextLink> : null}
    </div>
  );
}

type ReconcileApproval = ApprovalTaskProps["reconcile"];

function FormSpecApprovalResolution({ approval, active, editable, onResolved, reconcile, onDirtyChange, onOpenRecord, onOpenEvidence }: {
  approval: PendingWorkflowDecision; active: boolean; editable: boolean; onResolved: () => void; reconcile?: ReconcileApproval; onDirtyChange?: (dirty: boolean) => void;
  onOpenRecord?: WorkflowDecisionContentProps["openRecord"];
  onOpenEvidence?: WorkflowDecisionContentProps["openEvidence"];
}): React.ReactElement {
  const t = useWorkflowsT();
  const fields = useFormSpecFields(approval.decision_schema);
  const contextFields = React.useMemo(() => fields.filter((field) => field.layout === "context"), [fields]);
  const inputFields = React.useMemo(() => fields.filter((field) => field.layout !== "context"), [fields]);
  const contextValues = React.useMemo(
    () => formSpecInitialValues(contextFields, approval.payload),
    [approval.payload, contextFields],
  );
  const [values, setValues] = React.useState<Record<string, unknown>>(
    () => formSpecInitialValues(inputFields, active ? approval.payload : approval.resolution),
  );
  const fieldNames = React.useMemo(() => inputFields.map((field) => field.name), [inputFields]);
  const validationErrors = useDottedPathFieldErrors(fieldNames);
  const [error, setError] = React.useState<string | null>(null);
  const resolution = useApprovalResolver(onResolved, reconcile);
  const contributions = useModelSlot({
    slot: WORKFLOW_DECISION_CONTENT_SLOT,
    model: DECISION_MODEL,
    impl: approval.action,
  });
  const contributedContent = contributions[0]?.content;
  const Content = typeof contributedContent === "function"
    ? contributedContent as React.ComponentType<WorkflowDecisionContentProps>
    : undefined;
  const setValue = React.useCallback((name: string, value: unknown) => {
    validationErrors.clearField(name);
    onDirtyChange?.(true);
    setValues((current) => ({ ...current, [name]: value }));
  }, [onDirtyChange, validationErrors]);
  async function resolve(verdict: ApprovalVerdict, submittedValues: Readonly<Record<string, unknown>> = values): Promise<void> {
    setError(null); validationErrors.clear();
    try {
      validationErrors.replace(await resolution.resolve(approval.id, verdict, submittedValues));
    } catch (cause) {
      setError(errorMessage(cause, t("inbox.actionFailed")));
    }
  }
  const contentProps: WorkflowDecisionContentProps = {
    approval, contextFields, contextValues, inputFields, values, setValue,
    messagesFor: validationErrors.messagesFor,
    resolve, editable, fetching: resolution.fetching, readOnly: !editable,
    openRecord: onOpenRecord, openEvidence: onOpenEvidence,
  };
  return (
    <div className="space-y-4">
      {editable && !Content ? <ApprovalVerdictButtons fetching={resolution.fetching} onResolve={resolve} /> : null}
      {Content ? <Content {...contentProps} /> : <>
      {contextFields.length ? <section className="space-y-3">
        <h3 className="text-xs font-semibold text-fg-muted">{t("inbox.decisionContext")}</h3>
        {contextFields.map((field) => (
          <LabeledDescriptorField key={field.name} field={field} value={contextValues[field.name]}
            readOnly messages={[]} onChange={() => undefined} />
        ))}
      </section> : null}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-fg-muted">{t("inbox.yourDecision")}</h3>
      {inputFields.map((field) => (
        <LabeledDescriptorField key={field.name} field={field} value={values[field.name]}
          readOnly={field.readOnly || !editable || resolution.fetching} messages={validationErrors.messagesFor(field.name)}
          onChange={(value) => setValue(field.name, value)} />
      ))}
      </section>
      </>}
      <ErrorBanner description={error ?? resolution.error?.message ?? validationErrors.formSummary} />
    </div>
  );
}

function JsonApprovalResolution({ approval, active, editable, onResolved, reconcile, onDirtyChange }: {
  approval: PendingWorkflowDecision; active: boolean; editable: boolean; onResolved: () => void; reconcile?: ReconcileApproval; onDirtyChange?: (dirty: boolean) => void;
}): React.ReactElement {
  const t = useWorkflowsT();
  const [payload, setPayload] = React.useState<JsonValue>(() => active ? {} : approval.resolution ?? {});
  const [jsonValid, setJsonValid] = React.useState(true);
  const validationErrors = useDottedPathFieldErrors();
  const [error, setError] = React.useState<string | null>(null);
  const resolution = useApprovalResolver(onResolved, reconcile);
  const validationError = validationErrors.formSummary;
  async function resolve(verdict: ApprovalVerdict): Promise<void> {
    setError(null); validationErrors.clear();
    if (!jsonValid) return;
    try { validationErrors.replace(await resolution.resolve(approval.id, verdict, payload)); }
    catch (cause) { setError(errorMessage(cause, t("inbox.actionFailed"))); }
  }
  return (
    <section className="space-y-3">
      <FieldRoot invalid={Boolean(error || validationError)}>
        <FieldLabel>{t("inbox.resolution")}</FieldLabel>
        <JsonEditor
          value={payload}
          field={{ label: t("inbox.resolution") }}
          readOnly={!editable || resolution.fetching}
          onValidityChange={setJsonValid}
          onChange={(value) => {
            validationErrors.clear();
            onDirtyChange?.(true);
            setPayload(value);
          }}
        />
        <FieldDescription>{t("json.label")}</FieldDescription>
      </FieldRoot>
      <ErrorBanner description={error ?? resolution.error?.message ?? validationError} />
      {editable ? <ApprovalVerdictButtons disabled={!jsonValid} fetching={resolution.fetching} onResolve={resolve} /> : null}
    </section>
  );
}

function ApprovalVerdictButtons({ disabled = false, fetching, onResolve }: { disabled?: boolean; fetching: boolean; onResolve: (verdict: ApprovalVerdict) => void | Promise<void> }): React.ReactElement {
  const t = useWorkflowsT();
  return <div className="flex flex-wrap justify-end gap-2">
    <Button type="button" variant="ghost" disabled={disabled} loading={fetching} onClick={() => void onResolve("ESCALATE")}><Glyph name="workflow-escalate" />{t("inbox.escalate")}</Button>
    <Button type="button" variant="secondary" disabled={disabled} loading={fetching} onClick={() => void onResolve("REJECT")}><Glyph name="workflow-reject" />{t("inbox.reject")}</Button>
    <Button type="button" variant="primary" disabled={disabled} loading={fetching} onClick={() => void onResolve("COMPLETE")}><Glyph name="workflow-approve" />{t("inbox.complete")}</Button>
  </div>;
}

function useApprovalResolver(onResolved: () => void, reconcile?: ReconcileApproval): {
  resolve: (approval: string, verdict: ApprovalVerdict, payload: JsonValue) => Promise<DottedPathFieldErrorMap>;
  fetching: boolean; error: Error | null;
} {
  const t = useWorkflowsT();
  const [decide, state] = useAuthoredMutation(DecideWorkflowDecisionDocument, {
    dataProviderName: "public", invalidateModels: [DECISION_MODEL],
    shouldInvalidate: (data) => data?.decide?.validation_errors == null,
  });
  const ambiguous = React.useRef(false);
  const inFlight = React.useRef(false);
  const [resolving, setResolving] = React.useState(false);
  const resolve = React.useCallback(async (approval: string, verdict: ApprovalVerdict, payload: JsonValue): Promise<DottedPathFieldErrorMap> => {
    if (inFlight.current) return {};
    inFlight.current = true;
    setResolving(true);
    try {
      if (ambiguous.current) {
        if (!reconcile) throw new Error(t("inbox.reconcileBeforeRetry"));
        const current = await reconcile(approval);
        if (current == null) throw new Error(t("inbox.decisionUnavailable"));
        if (current.id !== approval) throw new Error(t("inbox.invalidResolutionResponse"));
        if (current.verdict !== "PENDING") throw new Error(t("inbox.decisionNoLongerPending"));
        ambiguous.current = false;
      }
      let data: Awaited<ReturnType<typeof decide>>;
      try {
        data = await decide({ decision: approval, verdict, payload });
      } catch (error) {
        ambiguous.current = true;
        throw error;
      }
      const response = data?.decide;
      if (!response) {
        ambiguous.current = true;
        throw new Error(t("inbox.invalidResolutionResponse"));
      }
      const wireErrors = response.validation_errors;
      const parsedErrors = validationErrorMap(wireErrors);
      if (wireErrors != null && parsedErrors === null) {
        ambiguous.current = true;
        throw new Error(t("inbox.invalidValidationErrors"));
      }
      const errors = parsedErrors ?? {};
      if (Object.keys(errors).length === 0) {
        if (!response.decision) {
          ambiguous.current = true;
          throw new Error(t("inbox.invalidResolutionResponse"));
        }
        const expectedVerdict = verdict === "COMPLETE" ? "COMPLETED"
          : verdict === "REJECT" ? "REJECTED" : "ESCALATED";
        if (response.decision.id !== approval || response.decision.verdict !== expectedVerdict) {
          ambiguous.current = true;
          throw new Error(t("inbox.invalidResolutionResponse"));
        }
        onResolved();
      }
      return errors;
    } finally {
      inFlight.current = false;
      setResolving(false);
    }
  }, [decide, onResolved, reconcile, t]);
  return { resolve, fetching: state.fetching || resolving, error: state.error };
}
