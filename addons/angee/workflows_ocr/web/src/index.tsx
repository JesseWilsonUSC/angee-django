import { defineBaseAddon, resourcePageRoutes } from "@angee/app";
import { lazyRouteComponent } from "@tanstack/react-router";
import { Tab, formViewSectionsSlot, useT } from "@angee/ui";
import { ExtractionEvidencePanel } from "./ExtractionEvidencePanel";

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
  slots: [{
    ...formViewSectionsSlot("workflows_ocr.Extraction"),
    id: "workflows-ocr.evidence",
    sequence: 10,
    content: <Tab id="evidence" label={<EvidenceLabel />}><ExtractionEvidencePanel /></Tab>,
  }],
});

function EvidenceLabel() {
  const t = useT("workflowsOcr");
  return <>{t("evidence")}</>;
}
