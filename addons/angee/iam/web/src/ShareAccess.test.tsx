// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  models: new Map<string, unknown>(),
  record: {
    resource: "notes.Note",
    canonicalResource: "notes.Note",
    dataProviderName: "console",
    recordId: "note-1",
    record: { id: "note-1", title: "Welcome" },
  },
  list: {
    resource: "notes.Note",
    fields: [] as readonly string[],
    refresh: vi.fn(),
    selectedIds: new Set<string>(),
    record: null as unknown,
  },
  query: {
    data: {
      record_access: [],
      record_access_options: [{ relation: "reader", permission: "share" }],
    },
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  },
  queryVariables: null as unknown,
  queryOptions: null as unknown,
  dialogProps: null as Record<string, unknown> | null,
}));

vi.mock("./documents", () => ({ RecordAccessDocument: {} }));

vi.mock("@angee/metadata", () => ({
  modelLabelSegment: (label: string) => label.slice(label.lastIndexOf(".") + 1),
  rowValueAtPath: (row: Record<string, unknown>, path: string) => row[path],
  useModelMetadata: (resource: string) => mocks.models.get(resource),
  useResourceInvalidates: () => [],
}));

vi.mock("@angee/refine", () => ({
  useActionMutation: () => [vi.fn()],
  useActionResultRun: () => async (run: () => unknown) => run(),
  useAuthoredQuery: (_document: unknown, variables: unknown, options: unknown) => {
    mocks.queryVariables = variables;
    mocks.queryOptions = options;
    return mocks.query;
  },
  useStableArray: (value: readonly string[]) => value,
}));

vi.mock("@angee/ui", async () => {
  const React = await import("react");
  return {
    Button: ({ children, variant, size, ...props }: {
      children: ReactNode;
      variant: string;
      size: string;
    }) => <button {...props} data-variant={variant} data-size={size}>{children}</button>,
    Glyph: ({ name }: { name: string }) => <span data-glyph={name} />,
    ManageAccessDialog: (props: Record<string, unknown>) => {
      mocks.dialogProps = props;
      const trigger = props.trigger as ReactElement<{ onClick?: () => void }>;
      return React.cloneElement(trigger, {
        onClick: () => (props.onOpenChange as (open: boolean) => void)(true),
      });
    },
    useActionResultRun: () => async (run: () => unknown) => run(),
    useRecordChromeContext: () => mocks.record,
    useResourceViewActionContext: () => mocks.list,
    useUiT: () => (key: string, values?: { count?: number }) => ({
      "access.share": "Share",
      "access.selection": `${values?.count ?? 0} selected records`,
    })[key] ?? key,
  };
});

import { ShareListChrome, ShareRecordChrome } from "./ShareAccess";

const resource = {
  modelLabel: "notes.Note",
  resourceType: "notes/note",
  recordRepresentation: "title",
  grantable: [{
    relation: "reader",
    permission: "share",
    subjects: [{ type: "auth/user", relation: null, resource: "iam.User" }],
  }],
};

describe("shared record access chrome", () => {
  beforeEach(() => {
    mocks.models = new Map([["notes.Note", { resource }]]);
    mocks.record = {
      resource: "notes.Note",
      canonicalResource: "notes.Note",
      dataProviderName: "console",
      recordId: "note-1",
      record: { id: "note-1", title: "Welcome" },
    };
    mocks.list = {
      resource: "notes.Note",
      fields: [],
      refresh: vi.fn(),
      selectedIds: new Set(),
      record: null,
    };
    mocks.queryVariables = null;
    mocks.queryOptions = null;
    mocks.dialogProps = null;
  });

  afterEach(cleanup);

  test("renders the default compact Share action and loads access on demand", () => {
    render(<ShareRecordChrome />);

    const trigger = screen.getByRole("button", { name: "Share" });
    expect(trigger.dataset.variant).toBe("icon");
    expect(trigger.dataset.size).toBe("iconMd");
    expect(trigger.querySelector('[data-glyph="share"]')).toBeTruthy();
    expect(mocks.dialogProps).toMatchObject({ label: "Welcome", targetIds: ["note-1"] });
    expect(mocks.queryOptions).toMatchObject({ enabled: false });

    fireEvent.click(trigger);
    expect(mocks.queryOptions).toMatchObject({ enabled: true });
    expect(mocks.queryVariables).toEqual({ targetType: "notes/note", targetIds: ["note-1"] });
  });

  test("shares the selected collection records in deterministic order", () => {
    mocks.list.selectedIds = new Set(["note-2", "note-1"]);

    render(<ShareListChrome />);

    expect((screen.getByRole("button", { name: "Share" }) as HTMLButtonElement).disabled).toBe(false);
    expect(mocks.dialogProps).toMatchObject({
      label: "2 selected records",
      targetIds: ["note-1", "note-2"],
    });
  });

  test("nested collections share their enclosing record", () => {
    mocks.list.resource = "projects.Task";
    mocks.list.selectedIds = new Set(["task-1"]);
    mocks.list.record = mocks.record;

    render(<ShareListChrome />);

    expect(mocks.dialogProps).toMatchObject({ label: "Welcome", targetIds: ["note-1"] });
    expect(mocks.queryVariables).toEqual({ targetType: "notes/note", targetIds: ["note-1"] });
  });

  test("omits Share when the model declares no grant surface", () => {
    mocks.models = new Map([["notes.Note", { resource: { ...resource, grantable: [] } }]]);

    render(<ShareRecordChrome />);

    expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
  });
});
