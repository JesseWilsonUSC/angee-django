// @vitest-environment happy-dom

import { act, cleanup, render as rtlRender } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import type { ReactElement, ReactNode } from "react";

import type { FormViewProps } from "../form/FormView";
import type { ListViewProps } from "./resource-view-types";

const captured = vi.hoisted(() => ({
  onCreateInLane: undefined as ListViewProps["onCreateInLane"],
  formDefaults: undefined as Record<string, unknown> | undefined,
  formRendered: 0,
}));

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
}));

vi.mock("./ListView", () => ({
  ListView: (props: ListViewProps) => {
    captured.onCreateInLane = props.onCreateInLane;
    return null;
  },
}));

vi.mock("../form/FormView", () => ({
  FormView: (props: FormViewProps) => {
    captured.formRendered += 1;
    captured.formDefaults = props.defaultValues as Record<string, unknown> | undefined;
    return null;
  },
}));

vi.mock("./useBulkDelete", () => ({
  useBulkDelete: () => ({
    canDelete: false, isPending: false, isPreviewOpen: false, previewState: null,
    previewRecordCount: 0, previewBlockedRecordCount: 0, previewOverflowCount: 0,
    deleteInitiate: vi.fn(), onConfirm: vi.fn(), onCancel: vi.fn(),
  }),
}));

import { ResourceList } from "./ResourceList";
import { Form } from "../form/Form";
import { Field } from "../page/Field";

beforeEach(() => {
  captured.onCreateInLane = undefined;
  captured.formDefaults = undefined;
  captured.formRendered = 0;
});
const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
});
function render(element: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  return rtlRender(element, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

// The board pages own `creating` themselves (QueueBoardPage, CycleBoardPage,
// TaskBoardPage), so the in-lane create has to travel out through `onSelect` and
// back in through `creating`.
function ControlledBoard({ onSelect }: { onSelect?: (id: string | null) => void }) {
  const [creating, setCreating] = React.useState(false);
  return (
    <ResourceList
      resource="agents.InferenceProvider"
      columns={[]}
      placement="drawer"
      defaultView="board"
      laneSource={{ field: "stage", rankField: "sort_order" }}
      formFields={[{ name: "name" }]}
      createDefaults={{ queue: "que_eng" }}
      creating={creating}
      onSelect={(id) => {
        onSelect?.(id);
        setCreating(id === null);
      }}
      onClose={() => setCreating(false)}
    />
  );
}

describe("in-lane create on a controlled board", () => {
  test("opens the create surface seeded with the lane it was pressed in", () => {
    const onSelect = vi.fn();
    render(<ControlledBoard onSelect={onSelect} />);

    expect(captured.onCreateInLane).toBeTypeOf("function");
    act(() => captured.onCreateInLane?.("stage_doing"));

    // The page's controlled `creating` is the only way the drawer opens here.
    expect(onSelect).toHaveBeenCalledWith(null);
    expect(captured.formRendered).toBeGreaterThan(0);

    // Pressing Add card in a lane means "a card in *this* lane".
    expect(captured.formDefaults).toMatchObject({
      queue: "que_eng",
      stage: "stage_doing",
    });
  });
});

// The board pages do not pass `formFields`; they render a `<Form>` declaration as
// a child (`useTaskFormDeclaration`). That declaration names the fields, so a
// create default for a field it does not name has nowhere to land.
function DeclaredFormBoard() {
  const [creating, setCreating] = React.useState(false);
  return (
    <ResourceList
      resource="agents.InferenceProvider"
      columns={[]}
      placement="drawer"
      defaultView="board"
      laneSource={{ field: "stage", rankField: "sort_order" }}
      createDefaults={{ queue: "que_eng" }}
      creating={creating}
      onSelect={(id) => setCreating(id === null)}
      onClose={() => setCreating(false)}
    >
      <Form resource="agents.InferenceProvider">
        <Field name="name" />
      </Form>
    </ResourceList>
  );
}

test("declared-form board: what the lane default does with an undeclared field", () => {
  render(<DeclaredFormBoard />);

  expect(captured.onCreateInLane).toBeTypeOf("function");
  act(() => captured.onCreateInLane?.("stage_doing"));

  // The surface opens here too -- a press that renders nothing is the reported
  // D6 symptom, and it does not happen in either shape.
  expect(captured.formRendered).toBeGreaterThan(0);

  // Both defaults reach the form even though the declaration names neither, so
  // nothing is lost on the way in. Whether they survive submission is a separate
  // question: `emptyDraft` builds the draft from declared fields only.
  expect(captured.formDefaults).toEqual({
    queue: "que_eng",
    stage: "stage_doing",
  });
});
