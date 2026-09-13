import * as React from "react";
import type { DocumentType } from "@angee/gql/console";
import { CodeBlock, TextLink, useResourceRecordHrefLookup, useT } from "@angee/ui";

import { ExtractionRecordEvidenceDocument } from "./documents";

export type ExtractionEvidence = NonNullable<DocumentType<typeof ExtractionRecordEvidenceDocument>["extraction_evidence"]>;

function json(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? "";
}

export function ExtractionEvidenceDetails({ evidence }: { evidence: ExtractionEvidence }): React.ReactElement {
  const t = useT("workflowsOcr");
  const recordHref = useResourceRecordHrefLookup();
  return <div className="grid gap-4 p-4">
    <div className="text-sm">
      <span className="font-medium">{t("revision")} {evidence.extraction.revision}</span>
      {" · "}{evidence.extraction.status}{" · "}{evidence.extraction.schema_id}
    </div>
    <section>
      <h3 className="mb-2 font-medium">{t("sources")}</h3>
      <ul className="grid gap-2 text-sm">
        {evidence.sources.map((source, index) => {
          const fileHref = source.file ? recordHref("storage.File", source.file) : undefined;
          const messageHref = source.source_message
            ? recordHref("messaging.Message", source.source_message)
            : undefined;
          return <li key={source.id} className="rounded-8 border border-border-subtle p-3">
            <div className="flex flex-wrap gap-2">
              <span>{t("source", { number: index + 1 })}</span>
              {fileHref ? <TextLink href={fileHref}>{t("openFile")}</TextLink> : null}
              {messageHref ? <TextLink href={messageHref}>{t("openMessage")}</TextLink> : null}
            </div>
            {source.file ? <div className="break-all text-xs text-fg-muted">File: {source.file}</div> : null}
            {source.message_part ? <div className="break-all text-xs text-fg-muted">Message part: {source.message_part}</div> : null}
            <div className="break-all text-xs text-fg-muted">{t("sourceHash")}: {source.content_hash}</div>
          </li>;
        })}
      </ul>
    </section>
    <details><summary className="cursor-pointer font-medium">{t("result")}</summary><CodeBlock wrap className="mt-2 max-h-96 overflow-auto">{json(evidence.result)}</CodeBlock></details>
    <details><summary className="cursor-pointer font-medium">{t("provenance")}</summary><CodeBlock wrap className="mt-2 max-h-96 overflow-auto">{json(evidence.provenance)}</CodeBlock></details>
    <details><summary className="cursor-pointer font-medium">{t("schema")}</summary><CodeBlock wrap className="mt-2 max-h-96 overflow-auto">{json(evidence.schema)}</CodeBlock></details>
    <details><summary className="cursor-pointer font-medium">{t("pages")} ({evidence.pages.length})</summary><CodeBlock wrap className="mt-2 max-h-96 overflow-auto">{json(evidence.pages)}</CodeBlock></details>
    <details><summary className="cursor-pointer font-medium">{t("parts")} ({evidence.parts.length})</summary><CodeBlock wrap className="mt-2 max-h-96 overflow-auto">{json(evidence.parts)}</CodeBlock></details>
  </div>;
}
