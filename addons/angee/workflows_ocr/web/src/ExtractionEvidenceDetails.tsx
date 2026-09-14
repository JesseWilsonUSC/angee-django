import * as React from "react";
import type { DocumentType } from "@angee/gql/console";
import { Button, CodeBlock, TextLink, useRecordPeekContext, useResourceRecordHrefLookup, useT } from "@angee/ui";
import { FileRecordPreview } from "@angee/storage";

import { ExtractionRecordEvidenceDocument } from "./documents";

export type ExtractionEvidence = NonNullable<DocumentType<typeof ExtractionRecordEvidenceDocument>["extraction_evidence"]>;

function json(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? "";
}

export function ExtractionEvidenceDetails({ evidence }: { evidence: ExtractionEvidence }): React.ReactElement {
  const t = useT("workflowsOcr");
  const recordHref = useResourceRecordHrefLookup();
  const peek = useRecordPeekContext();
  const [sourceId, setSourceId] = React.useState(evidence.sources[0]?.id);
  const selected = evidence.sources.find((source) => source.id === sourceId);
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
              <Button size="sm" variant={source.id === selected?.id ? "secondary" : "ghost"} aria-pressed={source.id === selected?.id} onClick={() => setSourceId(source.id)}>{t("source", { number: index + 1 })}</Button>
              {fileHref ? <TextLink href={fileHref} onClick={peek && source.file ? (event) => { event.preventDefault(); peek.openRecord({ model: "storage.File", id: source.file!, tab: "preview", label: t("source", { number: index + 1 }) }); } : undefined}>{t("openFile")}</TextLink> : null}
              {messageHref ? <TextLink href={messageHref} onClick={peek && source.source_message ? (event) => { event.preventDefault(); peek.openRecord({ model: "messaging.Message", id: source.source_message!, label: t("openMessage") }); } : undefined}>{t("openMessage")}</TextLink> : null}
            </div>
            <details className="mt-2 text-xs text-fg-muted"><summary>{t("sourceBinding")}</summary>
              <div className="break-all">{t("sourceHash")}: {source.content_hash}</div>
              <div className="break-all">{source.file} {source.message_part}</div>
            </details>
          </li>;
        })}
      </ul>
    </section>
    {selected?.file ? <div className="h-[65vh] min-h-80 overflow-hidden rounded-8 border border-border-subtle">
      <FileRecordPreview id={selected.file} page={evidence.sources.length === 1 ? peek?.reference.page : undefined} />
    </div> : null}
    <details><summary className="cursor-pointer font-medium">{t("result")}</summary><CodeBlock wrap className="mt-2 max-h-96 overflow-auto">{json(evidence.result)}</CodeBlock></details>
    <details><summary className="cursor-pointer font-medium">{t("provenance")}</summary><CodeBlock wrap className="mt-2 max-h-96 overflow-auto">{json(evidence.provenance)}</CodeBlock></details>
    <details><summary className="cursor-pointer font-medium">{t("schema")}</summary><CodeBlock wrap className="mt-2 max-h-96 overflow-auto">{json(evidence.schema)}</CodeBlock></details>
    <details><summary className="cursor-pointer font-medium">{t("pages")} ({evidence.pages.length})</summary><CodeBlock wrap className="mt-2 max-h-96 overflow-auto">{json(evidence.pages)}</CodeBlock></details>
    <details><summary className="cursor-pointer font-medium">{t("parts")} ({evidence.parts.length})</summary><CodeBlock wrap className="mt-2 max-h-96 overflow-auto">{json(evidence.parts)}</CodeBlock></details>
  </div>;
}
