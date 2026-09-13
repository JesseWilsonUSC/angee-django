import * as React from "react";

import { useUiT } from "../i18n";
import { cn } from "../lib/cn";
import { SkeletonStatus } from "../ui/skeleton";
import { Spinner } from "../ui/spinner";
import { textRoleVariants } from "../ui/text";

export interface LoadingPanelProps {
  message?: string;
  density?: "page" | "inline";
}

/** Unboxed pending status for boundaries that cannot know the final layout. */
export function LoadingPanel({
  message,
  density = "page",
}: LoadingPanelProps): React.ReactElement {
  const t = useUiT();
  const label = message ?? t("loading.default");
  const inline = density === "inline";

  return (
    <SkeletonStatus
      label={label}
      className={cn(
        "grid place-content-center",
        inline ? "min-h-16 p-3" : "h-full min-h-32 p-8",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          textRoleVariants({ role: "meta" }),
          "inline-flex items-center gap-2",
        )}
      >
        <Spinner size="sm" tone="muted" />
        {label}
      </span>
    </SkeletonStatus>
  );
}
