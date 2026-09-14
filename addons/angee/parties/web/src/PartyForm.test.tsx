// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({ kind: "organization" as "organization" | "person" | null, fetching: false }));

vi.mock("@angee/refine", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@angee/refine")>()),
  useAuthoredQuery: () => ({
    data: state.kind ? { parties_by_pk: { id: "party-1", concrete_kind: state.kind } } : { parties_by_pk: null },
    isFetching: state.fetching,
  }),
}));
vi.mock("./i18n", () => ({ usePartiesT: () => (key: string) => key }));
vi.mock("./OrganizationsPage", () => ({
  OrganizationForm: (props: { resource: string; id: string; readOnly?: boolean }) =>
    <div data-testid="organization-form">{props.resource}:{props.id}:{String(props.readOnly)}</div>,
}));
vi.mock("./PersonForm", () => ({
  PersonForm: (props: { resource: string; id: string; readOnly?: boolean }) =>
    <div data-testid="person-form">{props.resource}:{props.id}:{String(props.readOnly)}</div>,
}));

import { PartyForm, partyForm } from "./PartyForm";

afterEach(() => {
  cleanup();
  state.kind = "organization";
  state.fetching = false;
});

test.each([
  ["organization", "organization-form", "parties.Organization"],
  ["person", "person-form", "parties.Person"],
] as const)("delegates a %s parent to its canonical registered form", (kind, testId, resource) => {
  state.kind = kind;
  render(<PartyForm resource="parties.Party" id="party-1" readOnly />);
  expect(screen.getByTestId(testId).textContent).toBe(`${resource}:party-1:true`);
  expect(partyForm.resource).toBe("parties.Party");
});

test("does not invent a form for a missing or non-concrete Party", () => {
  state.kind = null;
  render(<PartyForm resource="parties.Party" id="party-1" readOnly />);
  expect(screen.getByText("partyRedirect.unavailable")).toBeTruthy();
  expect(screen.queryByTestId("organization-form")).toBeNull();
  expect(screen.queryByTestId("person-form")).toBeNull();
});
