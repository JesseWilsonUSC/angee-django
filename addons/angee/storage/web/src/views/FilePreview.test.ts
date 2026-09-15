import { describe, expect, test } from "vitest";

import { filePreviewPageFromSearch, filePreviewReference } from "./FilePreview";

describe("file preview references", () => {
  test("round-trips a one-based page only for the exact File", () => {
    const reference = filePreviewReference("fil_source", 2);

    expect(reference).toEqual({
      model: "storage.File",
      id: "fil_source",
      tab: "preview",
      page: 2,
      search: { previewPage: "fil_source:2" },
    });
    expect(filePreviewPageFromSearch(reference.search ?? {}, "fil_source")).toBe(2);
    expect(filePreviewPageFromSearch(reference.search ?? {}, "fil_other")).toBeNull();
  });
});
