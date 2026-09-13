// @vitest-environment happy-dom

import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  add: vi.fn(),
  listProps: [] as Record<string, unknown>[],
  mutationProps: null as Record<string, unknown> | null,
  queryData: undefined as unknown,
}));

vi.mock("@angee/refine", () => ({
  useAuthoredQuery: () => ({ data: mocks.queryData, isFetching: false, error: null }),
}));

vi.mock("@angee/ui", () => ({
  Button: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button>,
  Code: ({ children }: { children?: ReactNode }) => <code>{children}</code>,
  createNamespaceT: (
    _namespace: string,
    fallback: Record<string, string>,
  ) => () => (key: string) => fallback[key] ?? key,
  MutationDialog: (props: Record<string, unknown>) => {
    mocks.mutationProps = props;
    return null;
  },
  RowsListView: (props: Record<string, unknown>) => {
    mocks.listProps.push(props);
    return null;
  },
  SubjectPicker: () => null,
  defineRowAction: (value: Record<string, unknown>) => value,
  mutationDialogValueCodecs: {
    requiredString: (value: unknown) => String(value),
  },
  useAuthoredResourceMutation: () => [mocks.add],
}));

import { GroupMembersTab } from "./GroupAccessTabs";

describe("group access tabs", () => {
  beforeEach(() => {
    mocks.add.mockReset();
    mocks.listProps = [];
    mocks.mutationProps = null;
    mocks.queryData = {
      groups_by_pk: {
        id: "igr_1",
        members: [{
          id: "member-1",
          subject: "auth/user:9",
          subject_type: "auth/user",
          subject_id: "9",
          label: "Service robot",
          caveat_name: "office-hours",
        }],
        bindings: [],
      },
    };
  });

  test("removes the exact canonical member tuple", () => {
    render(<GroupMembersTab recordId="igr_1" />);
    const [remove] = mocks.listProps[0]?.rowActions as Array<{
      variables: (row: Record<string, string>) => unknown;
    }>;
    expect(remove.variables((mocks.queryData as {
      groups_by_pk: { members: Record<string, string>[] };
    }).groups_by_pk.members[0]!)).toEqual({
      group_id: "igr_1",
      subject: "auth/user:9",
      caveat_name: "office-hours",
    });
  });

  test("adds the selected canonical subject with an explicit empty caveat", async () => {
    mocks.add.mockResolvedValue({ add_group_member: true });
    render(<GroupMembersTab recordId="igr_1" />);
    const submit = mocks.mutationProps?.onSubmit as (values: { subject: string }) => Promise<void>;
    await submit({ subject: "auth/user:9" });
    expect(mocks.add).toHaveBeenCalledWith({
      group_id: "igr_1",
      subject: "auth/user:9",
      caveat_name: "",
    });
  });
});
