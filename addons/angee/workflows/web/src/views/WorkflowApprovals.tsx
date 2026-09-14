import * as React from "react";
import { useAuthoredQuery } from "@angee/refine";
import {
  Button,
  Column,
  EmptyState,
  ErrorBanner,
  Field,
  Form,
  Glyph,
  List,
  LoadingPanel,
  ResourceList,
  RecordPager,
  errorMessage,
  useUnsavedChangesNavigationGuard,
  type RecordPanelContext,
  type RecordNavigation,
} from "@angee/ui";

import { ScopedWorkflowDecisionDocument, TargetedTabWorkflowDecisionDocument, TargetedWorkflowDecisionDocument, WorkflowDecisionDocument, type PendingWorkflowDecision } from "../documents.public";
import { useWorkflowsT } from "../i18n";
import { ApprovalTask } from "./ApprovalTask";

const DECISION_MODEL = "workflows.Decision";

export interface WorkflowApprovalsProps {
  runId?: string;
  executionId?: string;
  attemptId?: string;
  target?: { model: string; id: string; tab?: string };
  includeResolved?: boolean;
  decisionId?: string | null;
  onDecisionChange?: (id: string | null) => void;
  selectedTaskOnly?: boolean;
  routed?: boolean;
}

/** One bounded native Decision collection scoped to a Run or exact related record. */
export function WorkflowApprovals({ runId, executionId, attemptId, target, includeResolved = false, decisionId, onDecisionChange, selectedTaskOnly = false, routed = false }: WorkflowApprovalsProps): React.ReactElement {
  const t = useWorkflowsT();
  const requestedScope = React.useMemo(
    () => ({
      runId,
      executionId,
      attemptId,
      target: target ? { model: target.model, id: target.id, tab: target.tab } : undefined,
    }),
    [attemptId, executionId, runId, target?.id, target?.model, target?.tab],
  );
  const [scope, setScope] = React.useState(requestedScope);
  const [localSelectedId, setLocalSelectedId] = React.useState<string | null>(null);
  const selectedId = decisionId !== undefined ? decisionId : localSelectedId;
  const [taskDirty, setTaskDirty] = React.useState(false);
  const dirtyRef = React.useRef(false);
  const setDirty = React.useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
    setTaskDirty(dirty);
  }, []);
  const requestLeave = useUnsavedChangesNavigationGuard({
    isDirty: taskDirty,
    isDirtyNow: React.useCallback(() => dirtyRef.current, []),
    readOnly: false,
  });
  const scopeKey = `${runId ?? ""}:${executionId ?? ""}:${attemptId ?? ""}:${target?.model ?? ""}:${target?.id ?? ""}:${target?.tab ?? ""}`;
  const previousScope = React.useRef(scopeKey);
  React.useEffect(() => {
    if (previousScope.current === scopeKey) return;
    void requestLeave().then((leave) => {
      if (leave) {
        previousScope.current = scopeKey;
        setDirty(false);
        if (decisionId === undefined) setLocalSelectedId(null);
        onDecisionChange?.(null);
        setScope(requestedScope);
      }
    });
  }, [decisionId, onDecisionChange, requestLeave, requestedScope, scopeKey, setDirty]);
  const selectDecision = React.useCallback((id: string | null) => {
    if (id === selectedId) return;
    void requestLeave().then((leave) => {
      if (leave) {
        setDirty(false);
        if (decisionId === undefined) setLocalSelectedId(id);
        onDecisionChange?.(id);
      }
    });
  }, [decisionId, onDecisionChange, requestLeave, selectedId, setDirty]);
  const tabs = React.useMemo(() => [{
    id: "decision",
    label: t("inbox.yourDecision"),
    render: (context: RecordPanelContext) => scope.target
      ? <TargetedDecisionTask key={context.recordId} {...context} target={scope.target} onDirtyChange={setDirty} />
      : scope.runId
        ? <ScopedDecisionTask key={context.recordId} {...context} runId={scope.runId} onDirtyChange={setDirty} />
        : <GlobalDecisionTask key={context.recordId} {...context} onDirtyChange={setDirty} />,
  }], [scope.runId, scope.target?.id, scope.target?.model, scope.target?.tab, setDirty, t]);
  if (routed) {
    return (
      <section aria-label={t("inbox.title")} className="h-full min-h-0">
        <ResourceList
          resource={DECISION_MODEL}
          routed
          placement="inline"
          hideCreate
          pageSize={20}
          defaultFilter={{ verdict: { exact: "PENDING" } }}
          defaultGroup={{ field: "step_run.run.workflow" }}
          groupOptions={[
            { id: "workflow", label: t("inbox.groupWorkflow"), group: { field: "step_run.run.workflow" } },
            { id: "action", label: t("inbox.groupAction"), group: { field: "action" } },
          ]}
          renderRecord={({ recordId, navigation, onClose }) => recordId ? (
            <RoutedDecisionTask recordId={recordId} navigation={navigation}
              onClose={onClose}
              onResolved={navigation?.onNext ?? onClose}
              onDirtyChange={setDirty} requestLeave={requestLeave} />
          ) : null}
        >
          <List resource={DECISION_MODEL} order={{ priority: "ASC", updated_at: "ASC" }} emptyContent={{
            icon: "workflow-inbox", title: t("inbox.queueComplete"), description: t("inbox.queueCompleteDescription"),
          }}>
            <Column field="step_run.step" header={t("inbox.colDecision")} />
            <Column field="step_run.run.workflow" header={t("inbox.colWorkflow")} />
            <Column field="verdict" widget="statusBadge" />
            <Column field="priority" />
            <Column field="updated_at" />
          </List>
        </ResourceList>
      </section>
    );
  }
  if (selectedTaskOnly && selectedId) {
    const onBack = onDecisionChange ? () => selectDecision(null) : undefined;
    const task = scope.target
      ? <TargetedDecisionTask
        key={`${scope.target.model}:${scope.target.id}:${scope.target.tab ?? ""}:${selectedId}`}
        recordId={selectedId}
        reload={() => undefined}
        target={scope.target}
        onDirtyChange={setDirty}
        onBack={onBack}
      />
      : scope.runId
        ? <ScopedDecisionTask
          key={`${scope.runId}:${selectedId}`}
          recordId={selectedId}
          reload={() => undefined}
          runId={scope.runId}
          onDirtyChange={setDirty}
          onBack={onBack}
        />
        : <GlobalDecisionTask
          key={selectedId}
          recordId={selectedId}
          reload={() => undefined}
          onDirtyChange={setDirty}
          onBack={onBack}
        />;
    return <section aria-label={t("inbox.title")} className="h-full min-h-0">
      {task}
    </section>;
  }
  return (
    <section aria-label={t("inbox.title")} className="h-full min-h-0">
      <ResourceList
        resource={DECISION_MODEL}
        scope="local"
        placement="inline"
        recordId={selectedId}
        onSelect={(id) => selectDecision(id)}
        onClose={() => selectDecision(null)}
        hideCreate
        pageSize={20}
        baseFilter={{
          ...(scope.runId ? { "step_run.run": { exact: scope.runId } } : {}),
          ...(scope.executionId ? { step_run: { exact: scope.executionId } } : {}),
          ...(scope.attemptId ? { suspension_attempt: { exact: scope.attemptId } } : {}),
          ...(scope.target ? { target_model: { exact: scope.target.model }, target_id: { exact: scope.target.id } } : {}),
          ...(scope.target?.tab ? { target_tab: { exact: scope.target.tab } } : {}),
          ...(!includeResolved ? { verdict: { exact: "PENDING" } } : {}),
        }}
        recordTabs={tabs}
        defaultRecordTab="decision"
        overviewTab={{ label: t("form.details"), position: "last" }}
      >
        <List resource={DECISION_MODEL} order={{ priority: "ASC" }} emptyContent={t("inbox.emptyDescription")}>
          <Column field="action" />
          <Column field="verdict" widget="statusBadge" />
          <Column field="priority" />
          <Column field="updated_at" />
        </List>
        <Form resource={DECISION_MODEL} readOnly>
          <Field name="action" title readOnly />
          <Field name="verdict" widget="statusBadge" readOnly />
          <Field name="priority" readOnly />
          <Field name="updated_at" readOnly />
        </Form>
      </ResourceList>
    </section>
  );
}

export function RoutedDecisionTask({ recordId, navigation, onClose, onResolved, onDirtyChange, requestLeave }: {
  recordId: string;
  navigation: RecordNavigation | null;
  onClose: () => void;
  onResolved: () => void;
  onDirtyChange: (dirty: boolean) => void;
  requestLeave: () => Promise<boolean>;
}): React.ReactElement {
  const t = useWorkflowsT();
  const decision = useAuthoredQuery(
    WorkflowDecisionDocument,
    { id: recordId },
    { dataProviderName: "public", models: [DECISION_MODEL], records: [{ model: DECISION_MODEL, id: recordId }] },
  );
  const afterLeave = React.useCallback((action: () => void) => {
    void requestLeave().then((leave) => {
      if (leave) {
        onDirtyChange(false);
        action();
      }
    });
  }, [onDirtyChange, requestLeave]);
  const guardedNavigation = navigation ? {
    ...navigation,
    onPrev: navigation.onPrev ? () => afterLeave(navigation.onPrev!) : undefined,
    onNext: navigation.onNext ? () => afterLeave(navigation.onNext!) : undefined,
  } : null;
  return <div className="flex h-full min-h-0 flex-col bg-sheet-1">
    <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2">
      <Button type="button" variant="ghost" onClick={() => afterLeave(onClose)}>
        <Glyph name="chevron-left" />{t("inbox.back")}
      </Button>
      <div className="ml-auto flex items-center gap-2">
        {guardedNavigation ? <RecordPager navigation={guardedNavigation} /> : null}
        {guardedNavigation?.onNext ? (
          <Button type="button" variant="ghost" onClick={guardedNavigation.onNext}>
            {t("inbox.nextDecision")}<Glyph name="chevron-right" />
          </Button>
        ) : null}
      </div>
    </div>
    <DecisionTaskResult context={{ recordId, reload: () => undefined }} approval={decision.data?.workflow_decisions[0]}
      onDirtyChange={onDirtyChange} fetching={decision.isFetching} error={decision.error}
      refetch={async () => (await decision.refetch()).data?.workflow_decisions[0] ?? null}
      onResolved={onResolved} />
  </div>;
}

function TargetedDecisionTask({ recordId, reload, target, onDirtyChange, onBack }: {
  recordId: string;
  reload: () => void;
  target: { model: string; id: string; tab?: string };
  onDirtyChange: (dirty: boolean) => void;
  onBack?: () => void;
}): React.ReactElement {
  return target.tab
    ? <TargetedTabDecisionTask recordId={recordId} reload={reload} target={{ ...target, tab: target.tab }} onDirtyChange={onDirtyChange} onBack={onBack} />
    : <TargetedRecordDecisionTask recordId={recordId} reload={reload} target={target} onDirtyChange={onDirtyChange} onBack={onBack} />;
}

function TargetedRecordDecisionTask({ recordId, reload, target, onDirtyChange, onBack }: {
  recordId: string; reload: () => void; target: { model: string; id: string }; onDirtyChange: (dirty: boolean) => void; onBack?: () => void;
}): React.ReactElement {
  const decision = useAuthoredQuery(
    TargetedWorkflowDecisionDocument,
    { id: recordId, targetModel: target.model, targetId: target.id },
    { dataProviderName: "public", models: [DECISION_MODEL], records: [{ model: DECISION_MODEL, id: recordId }] },
  );
  return <DecisionTaskResult context={{ recordId, reload }} approval={decision.data?.workflow_decisions[0]} onDirtyChange={onDirtyChange}
    fetching={decision.isFetching} error={decision.error} refetch={async () => (await decision.refetch()).data?.workflow_decisions[0] ?? null} onBack={onBack} />;
}

function TargetedTabDecisionTask({ recordId, reload, target, onDirtyChange, onBack }: {
  recordId: string; reload: () => void; target: { model: string; id: string; tab: string }; onDirtyChange: (dirty: boolean) => void; onBack?: () => void;
}): React.ReactElement {
  const decision = useAuthoredQuery(
    TargetedTabWorkflowDecisionDocument,
    { id: recordId, targetModel: target.model, targetId: target.id, targetTab: target.tab },
    { dataProviderName: "public", models: [DECISION_MODEL], records: [{ model: DECISION_MODEL, id: recordId }] },
  );
  return <DecisionTaskResult context={{ recordId, reload }} approval={decision.data?.workflow_decisions[0]} onDirtyChange={onDirtyChange}
    fetching={decision.isFetching} error={decision.error} refetch={async () => (await decision.refetch()).data?.workflow_decisions[0] ?? null} onBack={onBack} />;
}

function GlobalDecisionTask(context: Pick<RecordPanelContext, "recordId" | "reload"> & { onDirtyChange: (dirty: boolean) => void; onBack?: () => void }): React.ReactElement {
  const decision = useAuthoredQuery(
    WorkflowDecisionDocument,
    { id: context.recordId },
    { dataProviderName: "public", models: [DECISION_MODEL], records: [{ model: DECISION_MODEL, id: context.recordId }] },
  );
  return <DecisionTaskResult context={context} approval={decision.data?.workflow_decisions[0]} onDirtyChange={context.onDirtyChange}
    fetching={decision.isFetching} error={decision.error} refetch={async () => (await decision.refetch()).data?.workflow_decisions[0] ?? null} onBack={context.onBack} />;
}

function ScopedDecisionTask({ recordId, reload, runId, onDirtyChange, onBack }: Pick<RecordPanelContext, "recordId" | "reload"> & { runId: string; onDirtyChange: (dirty: boolean) => void; onBack?: () => void }): React.ReactElement {
  const decision = useAuthoredQuery(
    ScopedWorkflowDecisionDocument,
    { id: recordId, run: runId },
    { dataProviderName: "public", models: [DECISION_MODEL], records: [{ model: DECISION_MODEL, id: recordId }] },
  );
  return <DecisionTaskResult context={{ recordId, reload }} approval={decision.data?.workflow_decisions[0]} onDirtyChange={onDirtyChange}
    fetching={decision.isFetching} error={decision.error} refetch={async () => (await decision.refetch()).data?.workflow_decisions[0] ?? null} onBack={onBack} />;
}

function DecisionTaskResult({ context, approval, fetching, error, refetch, onDirtyChange, onBack, onSkip, onResolved }: {
  context: Pick<RecordPanelContext, "recordId" | "reload">;
  approval?: PendingWorkflowDecision;
  fetching: boolean;
  error: unknown;
  refetch: () => Promise<PendingWorkflowDecision | null>;
  onDirtyChange: (dirty: boolean) => void;
  onBack?: () => void;
  onSkip?: () => void;
  onResolved?: () => void;
}): React.ReactElement {
  const t = useWorkflowsT();
  const [retainedState, setRetainedState] = React.useState({
    recordId: context.recordId,
    approval: approval?.id === context.recordId ? approval : undefined,
  });
  React.useEffect(() => {
    setRetainedState((current) => {
      const next = approval?.id === context.recordId ? approval : undefined;
      return current.recordId === context.recordId && current.approval === next
        ? current
        : { recordId: context.recordId, approval: next };
    });
  }, [approval, context.recordId]);
  const retained = retainedState.recordId === context.recordId
    ? retainedState.approval
    : undefined;
  if (fetching && !retained) return <LoadingPanel message={t("inbox.loading")} />;
  if (error && !retained) return (
    <UnavailableDecisionTask onBack={onBack}>
      <ErrorBanner description={errorMessage(error, t("inbox.decisionUnavailable"))} />
    </UnavailableDecisionTask>
  );
  if (!retained) {
    return (
      <UnavailableDecisionTask onBack={onBack}>
        <EmptyState icon="workflow-inbox" title={t("inbox.decisionUnavailable")} />
      </UnavailableDecisionTask>
    );
  }
  return (
    <ApprovalTask
      key={retained.id}
      approval={retained}
      onBack={onBack}
      onSkip={onSkip}
      onDirtyChange={onDirtyChange}
      available={!error && Boolean(approval)}
      onResolved={() => {
        onDirtyChange(false);
        void refetch();
        context.reload();
        onResolved?.();
      }}
      reconcile={refetch}
    />
  );
}

function UnavailableDecisionTask({ onBack, children }: {
  onBack?: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  const t = useWorkflowsT();
  return (
    <section className="h-full overflow-auto bg-sheet-1 p-4">
      {onBack ? (
        <Button type="button" variant="ghost" onClick={onBack}>
          <Glyph name="chevron-left" />
          {t("inbox.back")}
        </Button>
      ) : null}
      <div className={onBack ? "mt-4" : undefined}>{children}</div>
    </section>
  );
}
