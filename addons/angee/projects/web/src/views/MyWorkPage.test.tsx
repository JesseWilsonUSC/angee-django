// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import type * as React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  agendaHasRows: false,
}));

vi.mock("@angee/ui", () => ({
  Button: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Column: () => null,
  List: () => <div data-testid="tasks-list" />,
  PageBody: ({ children }: { children?: React.ReactNode }) => <main>{children}</main>,
  PageHeader: ({ title }: { title?: React.ReactNode }) => <h1>{title}</h1>,
  SectionEyebrow: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
  formatDateStorage: () => "2026-10-15",
  useRouteHref: () => () => "/projects/board",
  useRuntimeAuth: () => ({ user: { id: "usr_admin" } }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@angee/messaging", () => ({
  ActivityAgendaList: ({
    whenPopulated,
  }: {
    whenPopulated?: (list: React.ReactElement) => React.ReactNode;
  }) => (mocks.agendaHasRows && whenPopulated ? whenPopulated(<div data-testid="agenda" />) : null),
}));
vi.mock("../i18n", () => ({ useProjectsT: () => (key: string) => key }));
vi.mock("../task-actions", () => ({ useTaskRowActions: () => [] }));

import { MyWorkPage } from "./MyWorkPage";

afterEach(() => {
  cleanup();
  mocks.agendaHasRows = false;
});

describe("My Work", () => {
  test("is one plain list under the page title when no activities are due", () => {
    render(<MyWorkPage />);
    expect(screen.getByTestId("tasks-list")).toBeTruthy();
    // No eyebrow over the tasks, and no empty activities panel or heading.
    expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual([
      "myWork.title",
    ]);
    expect(screen.queryByTestId("agenda")).toBeNull();
  });

  test("adds the activities section with its heading only when activities are due", () => {
    mocks.agendaHasRows = true;
    render(<MyWorkPage />);
    expect(screen.getByRole("heading", { name: "myWork.activities" })).toBeTruthy();
    expect(screen.getByTestId("agenda")).toBeTruthy();
  });
});
