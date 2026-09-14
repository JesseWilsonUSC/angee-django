import { expect, test } from "vitest";

import { decisionHref, subjectDecisionRunId } from "../decision-navigation";

test("admits a Decision only from the canonical direct or artifact-related subject history", () => {
  const runs = [{ id: "direct-run" }, { id: "artifact-related-run" }];

  expect(subjectDecisionRunId("artifact-related-run", runs)).toBe("artifact-related-run");
  expect(subjectDecisionRunId("unrelated-run", runs)).toBeNull();
});

test("a Decision target opens the shared Workflows chatter tab", () => {
  expect(decisionHref("/accounting/entries/entry-1", "decision-1")).toBe(
    "/accounting/entries/entry-1?chatterTab=workflows&decision=decision-1",
  );
});
