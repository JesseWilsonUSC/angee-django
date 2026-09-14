import { CHATTER_TAB_SEARCH_KEY, recordTargetHref, recordTargetSearch } from "@angee/ui";

/** The workflows addon owns its record-bound decision selection. */
export const DECISION_SEARCH_KEY = "decision";

export function decisionSearch(search: Readonly<Record<string, unknown>>, decision: string | null): Record<string, unknown> {
  return recordTargetSearch(search, { search: {
    [CHATTER_TAB_SEARCH_KEY]: decision ? "workflows" : null,
    [DECISION_SEARCH_KEY]: decision,
  } });
}

export function decisionHref(href: string, decision: string, tab?: string | null): string {
  return recordTargetHref(href, { tab, search: {
    [CHATTER_TAB_SEARCH_KEY]: "workflows",
    [DECISION_SEARCH_KEY]: decision,
  } });
}

/** Keep a route-selected Decision inside the canonical direct/artifact subject history. */
export function subjectDecisionRunId(
  decisionRunId: string | null | undefined,
  subjectRuns: ReadonlyArray<{ id: string }>,
): string | null {
  if (!decisionRunId) return null;
  return subjectRuns.some((run) => run.id === decisionRunId) ? decisionRunId : null;
}
