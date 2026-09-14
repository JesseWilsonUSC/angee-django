import { describe, expect, test, vi } from "vitest";

import type { GraphQLClient } from "./graphql";
import { grantRecordAccess, revokeRecordAccess } from "./record-access";

const grant = {
  targetType: "notes/note",
  targetId: "nte_1",
  relation: "reader",
  subject: "auth/user:1",
};

describe("record access helpers", () => {
  test("write and revoke the same canonical access tuple", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        data: { grant_record_access: { ok: true, message: "granted" } },
      })
      .mockResolvedValueOnce({
        data: { revoke_record_access: { ok: true, message: "revoked" } },
      });
    const client = { query } as unknown as GraphQLClient;

    expect(await grantRecordAccess(client, grant)).toEqual(grant);
    await revokeRecordAccess(client, grant);

    expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining("grant_record_access"), {
      targetType: grant.targetType,
      targetIds: [grant.targetId],
      relation: grant.relation,
      subject: grant.subject,
    });
    expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining("revoke_record_access"), {
      targetType: grant.targetType,
      targetIds: [grant.targetId],
      relation: grant.relation,
      subject: grant.subject,
    });
  });

  test("raises an in-band authorization error", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({
        data: { grant_record_access: { ok: false, message: "denied" } },
      }),
    } as unknown as GraphQLClient;

    await expect(grantRecordAccess(client, grant)).rejects.toThrow("denied");
  });
});
