// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("../../layouts/primary-pane-context", () => ({
  PrimaryPanePublisher: () => null,
}));

import { ScopedExplorerPane } from "./ScopedExplorerPane";

afterEach(cleanup);

const emptyExplorer = {
  roots: [],
  getRootId: (root: { id: string }) => root.id,
  getRootLabel: (root: { id: string }) => root.id,
  getTreeRows: () => [] as Array<{ id: string }>,
  navigatorLabel: "Folders",
  rootPicker: { "aria-label": "Drive" },
  renderTree: () => null,
};

test("renders caller content without roots only when explicitly requested", () => {
  const { rerender } = render(
    <ScopedExplorerPane {...emptyExplorer}>
      {() => <div>Owned content</div>}
    </ScopedExplorerPane>,
  );

  expect(screen.queryByText("Owned content")).toBeNull();

  rerender(
    <ScopedExplorerPane {...emptyExplorer} renderContentWithoutRoots>
      {() => <div>Owned content</div>}
    </ScopedExplorerPane>,
  );

  expect(screen.getByText("Owned content")).toBeTruthy();
});
