import * as React from "react";
import {
  Button,
  ControlBandProvider,
  Dialog,
  FormRoot,
  RegisteredFormView,
  RelationPicker,
  relationValueId,
  useRelationOptions,
  type WidgetDefinition,
  type WidgetRenderProps,
} from "@angee/ui";

import { usePartiesT } from "./i18n";

export interface PartyPickerProps {
  value?: string | null;
  onChange: (value: string) => void;
  label?: React.ReactNode;
  readOnly?: boolean;
}

function PartyPickerWidget({ value, onChange, onCommit, readOnly, field }: WidgetRenderProps<unknown>): React.ReactElement {
  return <PartyPicker value={relationValueId(value)}
    label={field?.label} readOnly={readOnly} onChange={(next) => { onChange?.(next); onCommit?.(); }} />;
}

export const partyPickerWidget = {
  edit: PartyPickerWidget,
  read: (props) => <PartyPickerWidget {...props} readOnly />,
} satisfies WidgetDefinition<unknown>;

/** Canonical Party selection with explicit subtype creation through native forms. */
export function PartyPicker({ value, onChange, label, readOnly }: PartyPickerProps): React.ReactElement {
  const t = usePartiesT();
  const labelId = React.useId();
  const [personOpen, setPersonOpen] = React.useState(false);
  const parties = useRelationOptions({ resource: "parties.Party", labelField: "display_name", canCreate: false });
  return <FormRoot.Field label={label ?? t("partyPicker.label")} labelProps={{ id: labelId }}>
    <div className="flex flex-wrap items-center gap-2">
      <RelationPicker aria-labelledby={labelId} value={value} options={parties.options} readOnly={readOnly}
        create={readOnly ? undefined : { resource: "parties.Organization", title: t("partyPicker.createOrganization") }}
        onCreated={() => parties.list.refetch()} onChange={onChange} />
      {!readOnly ? <Button type="button" size="sm" variant="secondary" onClick={() => setPersonOpen(true)}>{t("partyPicker.createPerson")}</Button> : null}
    </div>
    <Dialog.Root open={personOpen} onOpenChange={setPersonOpen}>
      <Dialog.Portal><Dialog.Backdrop /><Dialog.Content size="lg">
        <Dialog.Header><Dialog.Title>{t("partyPicker.createPerson")}</Dialog.Title><Dialog.Close /></Dialog.Header>
        <Dialog.Body><ControlBandProvider host={undefined}>
          <RegisteredFormView resource="parties.Person" id={null} onSaved={(row) => {
            const id = typeof row.id === "string" ? row.id : null;
            if (id) onChange(id);
            parties.list.refetch();
            setPersonOpen(false);
          }} />
        </ControlBandProvider></Dialog.Body>
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  </FormRoot.Field>;
}
