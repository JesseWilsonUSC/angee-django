export interface WorkflowPublicationRow {
  id?: unknown;
  publication_status?: unknown;
  current_published_version?: unknown;
}

export function publicationLabel(
  row: WorkflowPublicationRow,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  if (row.publication_status === "archived") return t("publication.retired");
  if (typeof row.current_published_version === "number") return t("publication.published", { version: row.current_published_version });
  return t("publication.unpublished");
}
