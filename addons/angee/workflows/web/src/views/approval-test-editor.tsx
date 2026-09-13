import * as React from "react";
import type { WidgetRenderProps } from "@angee/ui";

/** Lightweight transport-faithful JSON editor for approval behavior tests. */
export function ApprovalTestJsonEditor({
  value,
  field,
  readOnly,
  onChange,
  onValidityChange,
}: WidgetRenderProps): React.ReactElement {
  return (
    <textarea
      aria-label={field?.label ?? "JSON"}
      readOnly={readOnly}
      value={value === undefined ? "" : JSON.stringify(value, null, 2)}
      onChange={(event) => {
        try {
          const parsed = JSON.parse(event.target.value) as unknown;
          onValidityChange?.(true);
          onChange?.(parsed);
        } catch {
          onValidityChange?.(false);
        }
      }}
    />
  );
}
