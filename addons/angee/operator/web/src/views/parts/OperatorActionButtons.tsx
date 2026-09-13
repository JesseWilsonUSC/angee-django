import { Button } from "@angee/ui";
import type { ReactNode } from "react";

/** A presentation-only operator daemon action used outside collection columns. */
export interface OperatorAction<TSubject> {
  label: string;
  variant: "secondary" | "ghost";
  perform: (subject: TSubject) => Promise<void>;
  visible?: (subject: TSubject) => boolean;
}

export interface OperatorActionButtonsProps<TSubject> {
  actions: readonly OperatorAction<TSubject>[];
  busy: boolean;
  subject: TSubject;
  className?: string;
}

/** Compact operator controls for detail headers and embedded daemon rows. */
export function OperatorActionButtons<TSubject>({
  actions,
  busy,
  subject,
  className = "flex justify-end gap-1",
}: OperatorActionButtonsProps<TSubject>): ReactNode {
  return (
    <div className={className}>
      {actions.filter((action) => action.visible?.(subject) ?? true).map((action) => (
        <Button
          key={action.label}
          disabled={busy}
          onClick={() => void action.perform(subject)}
          size="sm"
          variant={action.variant}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
