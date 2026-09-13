import type { Query, QueryClient } from "@tanstack/react-query";

import { recordValue } from "./dialect/wire";

export function authoredQueryMeta(
  modelLabels: readonly string[],
): Record<string, unknown> | undefined {
  return modelLabels.length > 0 ? { angeeModels: [...modelLabels] } : undefined;
}

/**
 * Exact-match authored query metadata against canonical model labels supplied by
 * the caller; this metadata-free layer deliberately performs no alias mapping.
 */
export function authoredQueryReadsAnyModel(
  meta: unknown,
  modelLabels: readonly string[],
): boolean {
  const models = recordValue(meta)?.angeeModels;
  if (!Array.isArray(models)) return false;
  const wanted = new Set(modelLabels);
  return models.some((model) => typeof model === "string" && wanted.has(model));
}

/** Match one live row change, respecting an authored query's optional exact-record interests. */
export function authoredQueryReadsChange(meta: unknown, model: string, id: string): boolean {
  if (!authoredQueryReadsAnyModel(meta, [model])) return false;
  const metadata = recordValue(meta);
  const records = metadata?.angeeRecords;
  if (!Array.isArray(records)) return true;
  const broadModels = metadata?.angeeBroadModels;
  if (Array.isArray(broadModels) && broadModels.includes(model)) return true;
  return records.some((value) => {
    const record = recordValue(value);
    return record?.model === model && record?.id === id;
  });
}

/** Refetch authored reads affected by one exact live row change. */
export async function invalidateAuthoredQueriesForChange(
  queryClient: Pick<QueryClient, "cancelQueries" | "invalidateQueries">,
  model: string,
  id: string,
): Promise<void> {
  return invalidateAuthoredQueriesMatching(
    queryClient,
    (query) => authoredQueryReadsChange(query.meta, model, id),
  );
}

/** Refetch every active authored read registered against one of the moved models. */
export async function invalidateAuthoredQueries(
  queryClient: Pick<QueryClient, "cancelQueries" | "invalidateQueries">,
  modelLabels: readonly string[],
): Promise<void> {
  return invalidateAuthoredQueriesMatching(
    queryClient,
    (query) => authoredQueryReadsAnyModel(query.meta, modelLabels),
  );
}

/** One cancellation/refetch protocol shared by model-wide and exact-row invalidation. */
async function invalidateAuthoredQueriesMatching(
  queryClient: Pick<QueryClient, "cancelQueries" | "invalidateQueries">,
  predicate: (query: Query) => boolean,
): Promise<void> {
  // Native invalidation joins an initial in-flight request instead of restarting
  // it. Cancel that snapshot first so an event cannot be lost when it settles.
  await queryClient.cancelQueries({
    predicate: (query) => predicate(query)
      && query.state.data === undefined
      && query.state.fetchStatus !== "idle",
  });
  return queryClient.invalidateQueries({
    predicate,
    type: "all",
    refetchType: "active",
  });
}
