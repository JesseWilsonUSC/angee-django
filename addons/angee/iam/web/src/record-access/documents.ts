import { graphql } from "@angee/gql/console";

export const IamRecordAccess = graphql(`
  query IamRecordAccess($targetType: String!, $targetId: ID!) {
    record_access_options(target_type: $targetType, target_id: $targetId) { relation permission }
    record_access(target_type: $targetType, target_id: $targetId) {
      relation subject recipient { target_type target_id }
    }
  }
`);

export const IamGrantRecordAccess = graphql(`
  mutation IamGrantRecordAccess($targetType: String!, $targetId: ID!, $relation: String!, $recipient: RecordAccessRecipientInput!) {
    grant_record_access(target_type: $targetType, target_id: $targetId, relation: $relation, recipient: $recipient) { ok message }
  }
`);

export const IamRevokeRecordAccess = graphql(`
  mutation IamRevokeRecordAccess($targetType: String!, $targetId: ID!, $relation: String!, $recipient: RecordAccessRecipientInput!) {
    revoke_record_access(target_type: $targetType, target_id: $targetId, relation: $relation, recipient: $recipient) { ok message }
  }
`);
