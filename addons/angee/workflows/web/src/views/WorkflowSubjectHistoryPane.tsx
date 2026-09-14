import * as React from "react";
import { useAssignmentSubjects } from "@angee/iam";
import { useAuthoredQuery } from "@angee/refine";
import {
  Alert, Badge, EmptyState, ErrorBanner, LoadingPanel, TextLink, errorMessage,
  recordTargetHref, routeSearchParam, useResourceRecordHrefLookup, useRouteHref, useRouteSearch,
} from "@angee/ui";

import { DECISION_SEARCH_KEY, WORKFLOW_RUN_SEARCH_KEY, decisionHref, subjectDecisionRunId, subjectPendingDecision } from "../decision-navigation";
import { WorkflowSubjectHistoryPaneDocument } from "../documents.console";
import { WorkflowDecisionDocument } from "../documents.public";
import { useWorkflowsT } from "../i18n";
import { WorkflowApprovals } from "./WorkflowApprovals";

export function WorkflowSubjectHistoryPane({ subjectDeclaration, subjectId, actionContent }: {
  subjectDeclaration: string;
  subjectId: string;
  actionContent?: React.ReactNode;
}): React.ReactElement {
  const t = useWorkflowsT();
  const routeHref = useRouteHref();
  const recordHref = useResourceRecordHrefLookup();
  const assignmentSubjects = useAssignmentSubjects();
  const search = useRouteSearch();
  const decisionId = routeSearchParam(search, DECISION_SEARCH_KEY) ?? null;
  const followedRunId = routeSearchParam(search, WORKFLOW_RUN_SEARCH_KEY) ?? null;
  const recipientLabels = React.useMemo(
    () => new Map(assignmentSubjects.options.map((option) => [option.value, option.label])),
    [assignmentSubjects.options],
  );
  const query = useAuthoredQuery(
    WorkflowSubjectHistoryPaneDocument,
    { subjectDeclaration, id: subjectId },
    { models: ["workflows.WorkflowRun", "workflows.Decision", "workflows.StepArtifact"] },
  );
  const selectedDecision = useAuthoredQuery(
    WorkflowDecisionDocument,
    { id: decisionId ?? "" },
    {
      dataProviderName: "public",
      enabled: Boolean(decisionId),
      models: ["workflows.Decision"],
      records: decisionId ? [{ model: "workflows.Decision", id: decisionId }] : [],
    },
  );
  if (query.isFetching && !query.data) {
    return <div className="space-y-4 p-3">
      {actionContent}
      <LoadingPanel message={t("subjectHistory.loading")} />
    </div>;
  }
  if (query.error && !query.data) {
    return <div className="space-y-4 p-3">
      {actionContent}
      <ErrorBanner description={errorMessage(query.error, t("subjectHistory.unavailable"))} />
    </div>;
  }
  const history = query.data?.workflow_subject_history;
  const runs = history?.runs ?? [];
  const selected = selectedDecision.data?.workflow_decisions[0];
  const selectedRunId = selected && subjectDecisionRunId(selected.source_run_id, runs);
  const pending = decisionId ? undefined : subjectPendingDecision(
    history?.pending_decisions ?? [], followedRunId,
  );
  const pendingRunId = pending?.step_run?.run?.id;
  if (!runs.length) {
    return <div className="space-y-4 p-3">
      {actionContent}
      <EmptyState icon="workflow-run" title={t("subjectHistory.empty")} description={t("subjectHistory.emptyHint")} />
    </div>;
  }
  return <div className="space-y-4 p-3">
    {actionContent}
    {decisionId && selectedRunId ? (
      <WorkflowApprovals runId={selectedRunId} decisionId={decisionId} includeResolved selectedTaskOnly />
    ) : pending && pendingRunId ? (
      <WorkflowApprovals runId={pendingRunId} decisionId={pending.id} selectedTaskOnly />
    ) : null}
    {history?.truncated ? <Alert tone="info">
      {t("subjectHistory.truncated")} <TextLink href={routeHref("workflows.runs")}>{t("subjectHistory.openAllRuns")}</TextLink>
    </Alert> : null}
    {runs.map((run) => {
      const failure = (history?.failures ?? []).find((item) => item.run.id === run.id);
      const decisions = (history?.pending_decisions ?? []).filter(
        (decision) => decision.step_run?.run?.id === run.id,
      );
      const childRuns = (history?.child_runs ?? [])
        .filter((edge) => edge.parent_run_id === run.id)
        .map((edge) => edge.run);
      const runHref = routeHref("workflows.run", { id: run.id });
      return <section key={run.id} className="space-y-2 rounded-8 border border-border-subtle p-3">
        <div className="flex flex-wrap items-center gap-2">
          <TextLink href={runHref}>{run.workflow.name}</TextLink>
          <Badge tone={run.status === "SUCCEEDED" ? "success" : run.status === "FAILED" ? "danger" : "neutral"}>
            {run.status}
          </Badge>
        </div>
        {run.active_step ? <p className="text-13 text-fg-muted">
          {t("subjectHistory.activeStep", { step: run.active_step })}
        </p> : null}
        {run.waiting_kind ? <p className="text-13 text-fg-muted">
          {t("subjectHistory.waiting", { reason: run.waiting_kind })}
        </p> : null}
        {failure ? <div className="space-y-1 rounded-6 bg-danger-soft p-2 text-13 text-danger-text" role="alert">
          <p className="font-medium">{t("subjectHistory.failedStep", {
            step: failure.step?.name || failure.step?.key || failure.system_kind || t("subjectHistory.systemStep"),
          })}</p>
          <p>{failure.current_attempt?.error || failure.error || t("subjectHistory.failedFallback")}</p>
          <TextLink href={recordTargetHref(runHref, {
            search: {
              execution: failure.id,
              attempt: failure.current_attempt?.id ?? null,
              payload: failure.current_attempt?.id ? null : "failure",
            },
          })}>{t("subjectHistory.inspectFailure")}</TextLink>
        </div> : null}
        <div className="flex flex-wrap gap-2 text-13 text-fg-muted">
          {run.parent_step_run?.run ? <TextLink href={routeHref("workflows.run", { id: run.parent_step_run.run.id })}>
            {t("subjectHistory.parent", { workflow: run.parent_step_run.run.workflow.name })}
          </TextLink> : null}
          {run.reprocessed_from ? <TextLink href={routeHref("workflows.run", { id: run.reprocessed_from.id })}>
            {t("subjectHistory.reprocessed")}
          </TextLink> : null}
          {run.recovery_source_attempt?.step_run.run ? <TextLink href={routeHref("workflows.run", {
            id: run.recovery_source_attempt.step_run.run.id,
          })}>
            {t("subjectHistory.recoveredFrom", {
              workflow: run.recovery_source_attempt.step_run.run.workflow.name,
            })}
          </TextLink> : null}
          {childRuns.map((child) => <TextLink key={child.id} href={routeHref("workflows.run", { id: child.id })}>
            {t("subjectHistory.child", { workflow: child.workflow.name })}
          </TextLink>)}
        </div>
        {decisions.map((decision) => {
          const target = decision.target_reference;
          const targetHref = target?.model && target.id ? recordHref(target.model, target.id) : undefined;
          const href = targetHref ? decisionHref(targetHref, decision.id, target?.tab) : recordTargetHref(runHref, {
            tab: "approvals",
            search: { decision: decision.id },
          });
          return <div key={decision.id} className="space-y-1 text-13">
            <TextLink href={href}>{t("subjectHistory.decision", { action: decision.action })}</TextLink>
            {targetHref ? <p>
              <TextLink href={decisionHref(targetHref, decision.id, target?.tab ?? undefined)}>
                {t("subjectHistory.decisionTarget")}
              </TextLink>
            </p> : null}
            {decision.assignees.length ? <p className="text-fg-muted">
              {t("subjectHistory.recipients", {
                recipients: decision.assignees
                  .map((subject) => recipientLabels.get(subject) ?? subject)
                  .join(", "),
              })}
            </p> : null}
          </div>;
        })}
      </section>;
    })}
    {(history?.artifacts ?? []).length ? <section className="space-y-2">
      <h3 className="text-13 font-medium">{t("subjectHistory.outputs")}</h3>
      <ul className="space-y-1 text-13">{history!.artifacts.map((artifact) => {
        const target = artifact.target_reference;
        const href = target?.model && target.id ? recordHref(target.model, target.id) : undefined;
        return <li key={artifact.id}>{href
          ? <TextLink href={href}>{artifact.label || t("subjectHistory.output")}</TextLink>
          : artifact.label || t("subjectHistory.outputUnavailable")}</li>;
      })}</ul>
    </section> : null}
  </div>;
}
