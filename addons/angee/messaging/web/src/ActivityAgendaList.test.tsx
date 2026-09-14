// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activities: [] as unknown[],
}));

vi.mock("@angee/refine", () => ({
  useAuthoredQuery: () => ({
    data: { activity_agenda: mocks.activities },
    isFetching: false,
    error: null,
  }),
}));
vi.mock("@angee/ui", () => ({
  RowsListView: ({ rows, emptyContent }: { rows: readonly unknown[]; emptyContent?: string }) => (
    <div data-testid="rows">{rows.length > 0 ? rows.length : emptyContent}</div>
  ),
  TextLink: ({ children }: { children?: unknown }) => <a>{String(children)}</a>,
  useResourceRecordHrefLookup: () => () => undefined,
}));
vi.mock("./documents", () => ({ ACTIVITY_AGENDA_MODELS: [], ActivityAgendaDocument: {} }));
vi.mock("./i18n", () => ({ useMessagingT: () => (key: string) => key }));

import { ActivityAgendaList } from "./ActivityAgendaList";

const activity = {
  id: "act_1",
  summary: "Call the custodian",
  due_date: "2026-09-15",
  state: "planned",
  attachment: { label: "Angee rollout", model_label: "projects.Project", record_id: "prj_1" },
};

afterEach(() => {
  cleanup();
  mocks.activities = [];
});

describe("ActivityAgendaList", () => {
  test("keeps its empty state when the caller does not ask for a populated-only section", () => {
    render(<ActivityAgendaList windowStart="1970-01-01" windowEnd="2026-10-15" />);
    expect(screen.getByTestId("rows").textContent).toBe("agenda.empty");
  });

  test("renders nothing at all for a populated-only section with no activities", () => {
    const view = render(
      <ActivityAgendaList
        windowStart="1970-01-01"
        windowEnd="2026-10-15"
        whenPopulated={(list) => <section aria-label="due">{list}</section>}
      />,
    );
    expect(view.container.textContent).toBe("");
    expect(screen.queryByRole("region", { name: "due" })).toBeNull();
  });

  test("hands the list to the caller's section once there are activities", () => {
    mocks.activities = [activity];
    render(
      <ActivityAgendaList
        windowStart="1970-01-01"
        windowEnd="2026-10-15"
        whenPopulated={(list) => <section aria-label="due">{list}</section>}
      />,
    );
    expect(screen.getByRole("region", { name: "due" }).textContent).toBe("1");
  });
});
