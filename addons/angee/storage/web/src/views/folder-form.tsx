import { Field } from "@angee/ui";

/** Storage's folder form is shared by inline relation creation and editing. */
export const folderForm = (
  <>
    <Field name="name" title />
    <Field name="drive" required />
    <Field name="parent" />
    <Field name="description" />
  </>
);
