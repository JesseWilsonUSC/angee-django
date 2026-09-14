import {
  GraphQLClient,
  requireGraphQLData,
  type GraphQLResult,
} from "./graphql";

export interface RecordAccessGrant {
  targetType: string;
  targetId: string;
  relation: string;
  subject: string;
}

const GRANT_RECORD_ACCESS = `
  mutation GrantRecordAccess(
    $targetType: String!
    $targetIds: [ID!]!
    $relation: String!
    $subject: String!
  ) {
    grant_record_access(
      target_type: $targetType
      target_ids: $targetIds
      relation: $relation
      subject: $subject
    ) { ok message }
  }
`;

const REVOKE_RECORD_ACCESS = `
  mutation RevokeRecordAccess(
    $targetType: String!
    $targetIds: [ID!]!
    $relation: String!
    $subject: String!
  ) {
    revoke_record_access(
      target_type: $targetType
      target_ids: $targetIds
      relation: $relation
      subject: $subject
    ) { ok message }
  }
`;

type AccessOutcome = {
  ok: boolean;
  message: string;
};

/** Grant one record relation through the same authored API used by the Share dialog. */
export async function grantRecordAccess(
  client: GraphQLClient,
  grant: RecordAccessGrant,
): Promise<RecordAccessGrant> {
  const result = await client.query<{ grant_record_access: AccessOutcome }>(
    GRANT_RECORD_ACCESS,
    variables(grant),
  );
  requireOutcome(result, "grant_record_access");
  return grant;
}

/** Revoke one exact record relation written by `grantRecordAccess`. */
export async function revokeRecordAccess(
  client: GraphQLClient,
  grant: RecordAccessGrant,
): Promise<void> {
  const result = await client.query<{ revoke_record_access: AccessOutcome }>(
    REVOKE_RECORD_ACCESS,
    variables(grant),
  );
  requireOutcome(result, "revoke_record_access");
}

function variables(grant: RecordAccessGrant): Record<string, unknown> {
  return {
    targetType: grant.targetType,
    targetIds: [grant.targetId],
    relation: grant.relation,
    subject: grant.subject,
  };
}

function requireOutcome<K extends "grant_record_access" | "revoke_record_access">(
  result: GraphQLResult<Record<K, AccessOutcome>>,
  field: K,
): void {
  const outcome = requireGraphQLData(result)[field];
  if (!outcome?.ok) throw new Error(outcome?.message || "Record access mutation failed.");
}
