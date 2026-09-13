import { expectValidBaseAddon } from "@angee/app/testing";
import { createRouteHref } from "@angee/ui";
import { describe, expect, test } from "vitest";

import workflowsOcr from "./index";

describe("workflows OCR addon manifest", () => {
  test("registers immutable Extraction evidence as a native resource route", () => {
    expect(() => expectValidBaseAddon(workflowsOcr)).not.toThrow();
    const routes = workflowsOcr.routes ?? [];
    expect(routes.map((route) => [route.name, route.resource])).toEqual([
      ["workflows-ocr.extractions", "workflows_ocr.Extraction"],
      ["workflows-ocr.extractions.record", undefined],
    ]);
    const routeHref = createRouteHref(routes.map(({ name, path }) => ({ name, path })));
    expect(routeHref("workflows-ocr.extractions.record", { id: "ext 1" }))
      .toBe("/workflows/extractions/ext%201");
  });
});
