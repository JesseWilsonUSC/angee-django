import * as React from "react";

import { SlotOutlet } from "../../lib/slot-outlet";
import { makeContext, useSlot, type SlotContribution } from "../../runtime";
import { useRecordChromeContextMaybe, type RecordChromeContext } from "./record-chrome-context";
import type { ResourceViewFilter } from "./resource-view-model";

export const RESOURCE_VIEW_UTILITIES_SLOT = "resource-view.utilities";

export interface ResourceViewUtilityContext {
  resource: string;
  filter?: ResourceViewFilter;
  fields: readonly string[];
  refresh: () => void;
  /** Public ids selected by the collection owner. */
  selectedIds?: ReadonlySet<string>;
  /** Saved record enclosing this collection, for actions that explicitly target the parent. */
  record?: RecordChromeContext | null;
}

const ResourceViewUtilityContextBinding = makeContext<ResourceViewUtilityContext>(
  "ResourceViewUtilityContext",
);

export function useResourceViewUtilityContext(): ResourceViewUtilityContext {
  return ResourceViewUtilityContextBinding.use();
}

export function useResourceViewUtilities(resource: string): readonly SlotContribution[] {
  const entries = useSlot(RESOURCE_VIEW_UTILITIES_SLOT);
  return React.useMemo(() => {
    const result = entries.filter((entry) => entry.model === undefined || entry.model === resource);
    const ids = new Set<string>();
    for (const entry of result) {
      if (ids.has(entry.id)) {
        throw new Error(`Resource view utility "${entry.id}" is contributed more than once for "${resource}".`);
      }
      ids.add(entry.id);
    }
    return result;
  }, [entries, resource]);
}

export function ResourceViewUtilities({
  value,
}: {
  value: ResourceViewUtilityContext;
}): React.ReactElement | null {
  const entries = useResourceViewUtilities(value.resource);
  const record = useRecordChromeContextMaybe();
  if (entries.length === 0) return null;
  return (
    <ResourceViewUtilityContextBinding.Provider value={{ ...value, record }}>
      <SlotOutlet entries={entries} />
    </ResourceViewUtilityContextBinding.Provider>
  );
}

export function resourceViewUtilitiesSlot(model?: string): {
  slot: typeof RESOURCE_VIEW_UTILITIES_SLOT;
  model?: string;
} {
  return {
    slot: RESOURCE_VIEW_UTILITIES_SLOT,
    ...(model ? { model } : {}),
  };
}
