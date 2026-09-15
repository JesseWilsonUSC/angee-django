import { useEffect, useRef, useState, type ReactElement } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import {
  Button, cn, EmptyState, Glyph, LoadingPanel, textRoleVariants, type PreviewProviderProps } from "@angee/ui";

import { useStorageT } from "../i18n";

// pdf.js parses in a worker; point it at the worker from the pinned `pdfjs-dist`
// (held to react-pdf's exact version, so the worker and the API never skew).
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

/** Inline PDF viewer: one page at a time from `file.url`, with paging when the
 * document has more than one. react-pdf owns the fetch and its own
 * loading/error surfaces. */
export default function PdfPreview({ file, page: sourcePage }: PreviewProviderProps): ReactElement {
  const t = useStorageT();
  const [pageCount, setPageCount] = useState(0);
  const requestedPage = typeof sourcePage === "number" && Number.isInteger(sourcePage) && sourcePage > 0 ? sourcePage : 1;
  const [page, setPage] = useState(requestedPage);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>();
  // Follow an externally requested page; do not re-run when the count resolves,
  // so manual paging is never clobbered on load. The effective page is clamped
  // during render instead of mirrored into state.
  useEffect(() => {
    setPage(requestedPage);
  }, [requestedPage]);
  const currentPage = pageCount ? Math.min(page, pageCount) : page;
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(1, entry.contentRect.width));
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex h-full flex-col bg-inset">
      <div ref={viewportRef} className="min-h-0 flex-1 overflow-auto p-4">
        <Document
          file={file.url}
          onLoadSuccess={({ numPages }) => setPageCount(numPages)}
          loading={<LoadingPanel message={t("preview.loading")} />}
          error={
            <EmptyState
              icon="file"
              title={file.name}
              description={t("preview.loadError")}
            />
          }
          className="grid place-content-center"
        >
          <Page pageNumber={currentPage} width={width} className="shadow-sm" />
        </Document>
      </div>
      {pageCount > 1 ? (
        <div className={cn(textRoleVariants({ role: "meta" }), "flex items-center justify-center gap-3 border-t border-subtle bg-sheet p-2")}>
          <Button
            variant="ghost"
            size="iconSm"
            disabled={currentPage <= 1}
            aria-label={t("preview.pdfPrev")}
            onClick={() => setPage(Math.max(1, currentPage - 1))}
          >
            <Glyph name="chevron-left" />
          </Button>
          <span className="tabular-nums">
            {t("preview.pdfPage", {
              page: String(currentPage),
              total: String(pageCount),
            })}
          </span>
          <Button
            variant="ghost"
            size="iconSm"
            disabled={currentPage >= pageCount}
            aria-label={t("preview.pdfNext")}
            onClick={() => setPage(Math.min(pageCount, currentPage + 1))}
          >
            <Glyph name="chevron-right" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
