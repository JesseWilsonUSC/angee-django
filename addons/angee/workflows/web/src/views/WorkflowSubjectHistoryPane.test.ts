import { expect, test } from "vitest";

import { decisionHref, subjectDecisionRunId, subjectPendingDecision, workflowSubjectActionSearch } from "../decision-navigation";

test("admits a Decision only from the canonical direct or artifact-related subject history", () => {
  const runs = [{ id: "direct-run" }, { id: "artifact-related-run" }];

  expect(subjectDecisionRunId("artifact-related-run", runs)).toBe("artifact-related-run");
  expect(subjectDecisionRunId("unrelated-run", runs)).toBeNull();
});

test("a successful subject action clears stale Decision selection and follows its WorkflowRun", () => {
  expect(workflowSubjectActionSearch({ decision: "old", page: 2 }, "run-new")).toEqual({
    chatterTab: "workflows", page: 2, workflowRun: "run-new",
  });
});

test("a followed Run without a Decision does not expose an older pending task", () => {
  const pending = [{ id: "old", step_run: { run: { id: "run-old" } } }];
  expect(subjectPendingDecision(pending, "run-new")).toBeUndefined();
  expect(subjectPendingDecision(pending, null)).toBe(pending[0]);
});

test("a Decision target opens the shared Workflows chatter tab", () => {
  expect(decisionHref("/accounting/entries/entry-1", "decision-1")).toBe(
    "/accounting/entries/entry-1?chatterTab=workflows&decision=decision-1",
  );
});
