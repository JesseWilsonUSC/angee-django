import { useAuthoredQuery } from "@angee/refine";
import { Select, type SelectChoice, type SelectProps } from "@angee/ui";
import { useMemo, type ReactElement } from "react";

import {
  IamAssignmentSubjects,
  type IAMAssignmentSubjectsData,
  type IAMAssignmentSubjectsVariables,
} from "./documents";
import { userDisplayName } from "./identity-labels";
import { useIamT } from "./i18n";
import { IAM_LIST_LIMIT } from "./list-config";

export interface AssignmentSubjectOption extends SelectChoice {
  value: string;
  label: string;
  group: string;
  kind: "user" | "group";
  id: string;
}

export interface UseAssignmentSubjectsOptions {
  limit?: number;
}

export interface AssignmentSubjectsResult {
  options: readonly AssignmentSubjectOption[];
  isFetching: boolean;
  error: unknown;
  truncated: boolean;
  refetch: () => unknown;
}

export function assignmentSubjectOptions(
  data: IAMAssignmentSubjectsData | undefined,
  labels: { users: string; groups: string },
): readonly AssignmentSubjectOption[] {
  const users = (data?.users ?? [])
    .filter((user) => user.is_active)
    .map((user) => ({
      value: user.assignment_subject,
      label: userDisplayName(user, user.id),
      group: labels.users,
      kind: "user" as const,
      id: user.id,
    }));
  const groups = (data?.groups ?? []).map((group) => ({
    value: group.assignment_subject,
    label: group.name,
    group: labels.groups,
    kind: "group" as const,
    id: group.id,
  }));
  return [...users, ...groups];
}

export function useAssignmentSubjects(
  { limit = IAM_LIST_LIMIT }: UseAssignmentSubjectsOptions = {},
): AssignmentSubjectsResult {
  const t = useIamT();
  const variables = useMemo<IAMAssignmentSubjectsVariables>(() => ({ limit }), [limit]);
  const query = useAuthoredQuery(IamAssignmentSubjects, variables);
  const options = useMemo(
    () => assignmentSubjectOptions(query.data, {
      users: t("assignmentSubjects.users"),
      groups: t("assignmentSubjects.groups"),
    }),
    [query.data, t],
  );
  const userCount = query.data?.users_aggregate.aggregate?.count ?? 0;
  const groupCount = query.data?.groups_aggregate.aggregate?.count ?? 0;
  return {
    options,
    isFetching: query.isFetching,
    error: query.error,
    truncated: userCount > limit || groupCount > limit,
    refetch: query.refetch,
  };
}

export type AssignmentSubjectPickerProps = Omit<SelectProps, "options"> &
  UseAssignmentSubjectsOptions;

export function AssignmentSubjectPicker({
  limit,
  placeholder,
  disabled,
  ...props
}: AssignmentSubjectPickerProps): ReactElement {
  const t = useIamT();
  const subjects = useAssignmentSubjects({ limit });
  return (
    <Select
      {...props}
      options={subjects.options}
      placeholder={placeholder ?? (
        subjects.isFetching
          ? t("assignmentSubjects.loading")
          : t("assignmentSubjects.placeholder")
      )}
      disabled={disabled || subjects.isFetching || subjects.options.length === 0}
    />
  );
}
