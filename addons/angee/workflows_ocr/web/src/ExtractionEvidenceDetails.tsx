import * as React from "react";
import type { DocumentType } from "@angee/gql/console";
import { Badge, Button, CodeBlock, TextLink, statusTone, useRecordPeekContext, useResourceRecordHrefLookup, useT } from "@angee/ui";
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
  const fileHref = selected?.file ? recordHref("storage.File", selected.file) : undefined;
  const messageHref = selected?.source_message ? recordHref("messaging.Message", selected.source_message) : undefined;
  return <div className="grid gap-4 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className="font-medium">{t("revision")} {evidence.extraction.revision}</span>
      <Badge tone={statusTone(evidence.extraction.status)}>{evidence.extraction.status}</Badge>
    </div>
    <section aria-label={t("sources")} className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {evidence.sources.map((source, index) => <Button key={source.id} size="sm"
          variant={source.id === selected?.id ? "secondary" : "ghost"}
          aria-pressed={source.id === selected?.id} onClick={() => setSourceId(source.id)}>
          {t(source.file ? "documentSource" : source.source_message ? "messageSource" : "source", { number: index + 1 })}
        </Button>)}
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        {fileHref && selected?.file ? <TextLink href={fileHref} onClick={peek ? (event) => {
          event.preventDefault();
          peek.openRecord({ model: "storage.File", id: selected.file!, tab: "preview", label: t("document") });
        } : undefined}>{t("openFile")}</TextLink> : null}
        {messageHref && selected?.source_message ? <TextLink href={messageHref} onClick={peek ? (event) => {
          event.preventDefault();
          peek.openRecord({ model: "messaging.Message", id: selected.source_message!, label: t("message") });
        } : undefined}>{t("openMessage")}</TextLink> : null}
      </div>
    </section>
    {selected?.file ? <div className="h-[65vh] min-h-80 overflow-hidden rounded-8 border border-border-subtle">
      <FileRecordPreview id={selected.file} page={evidence.sources.length === 1 ? peek?.reference.page : undefined} />
    </div> : null}
    <details className="text-xs text-fg-muted">
      <summary className="cursor-pointer font-medium">{t("processingDetails")}</summary>
      <div className="mt-3 grid gap-3">
        <p>{evidence.extraction.schema_id}</p>
        {selected ? <details><summary>{t("sourceBinding")}</summary>
          <div className="break-all">{t("sourceHash")}: {selected.content_hash}</div>
          <div className="break-all">{selected.file} {selected.message_part}</div>
        </details> : null}
        <details><summary>{t("result")}</summary><CodeBlock wrap className="mt-2 max-h-96 overflow-auto">{json(evidence.result)}</CodeBlock></details>
        <details><summary>{t("provenance")}</summary><CodeBlock wrap className="mt-2 max-h-96 overflow-auto">{json(evidence.provenance)}</CodeBlock></details>
        <details><summary>{t("schema")}</summary><CodeBlock wrap className="mt-2 max-h-96 overflow-auto">{json(evidence.schema)}</CodeBlock></details>
        <details><summary>{t("pages")} ({evidence.pages.length})</summary><CodeBlock wrap className="mt-2 max-h-96 overflow-auto">{json(evidence.pages)}</CodeBlock></details>
        <details><summary>{t("parts")} ({evidence.parts.length})</summary><CodeBlock wrap className="mt-2 max-h-96 overflow-auto">{json(evidence.parts)}</CodeBlock></details>
      </div>
    </details>
  </div>;
}
