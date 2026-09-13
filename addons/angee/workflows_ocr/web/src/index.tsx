import { defineBaseAddon, resourcePageRoutes } from "@angee/app";
import { lazyRouteComponent } from "@tanstack/react-router";

import { enWorkflowsOcrMessages } from "./i18n";

export { ExtractionRecordEvidenceDocument } from "./documents";
export { ExtractionEvidenceDetails } from "./ExtractionEvidenceDetails";

export default defineBaseAddon({
  id: "workflows-ocr",
  routes: resourcePageRoutes(
    "workflows-ocr.extractions",
    "/workflows/extractions",
    lazyRouteComponent(() => import("./ExtractionsPage"), "ExtractionsPage"),
    "workflows_ocr.Extraction",
  ),
  i18n: { workflowsOcr: enWorkflowsOcrMessages },
});
