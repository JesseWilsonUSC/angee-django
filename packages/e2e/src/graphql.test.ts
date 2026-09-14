import type { APIRequestContext } from "@playwright/test";
import { describe, expect, test, vi } from "vitest";

import { GraphQLClient, requireGraphQLData } from "./graphql";

describe("GraphQLClient", () => {
  test("reports a non-JSON middleware response as a GraphQL error", async () => {
    const request = {
      get: vi.fn().mockResolvedValue({ ok: () => false }),
      post: vi.fn().mockResolvedValue({
        text: () => Promise.resolve("Account locked"),
        status: () => 403,
        statusText: () => "Forbidden",
      }),
    } as unknown as APIRequestContext;

    const result = await new GraphQLClient(request).query("query { viewer { id } }");

    expect(result).toEqual({
      errors: [{ message: "GraphQL request failed (403): Account locked" }],
    });
  });
});

describe("requireGraphQLData", () => {
  test("returns successful data", () => {
    expect(requireGraphQLData({ data: { id: "record-1" } })).toEqual({
      id: "record-1",
    });
  });

  test("reports GraphQL errors and missing data", () => {
    expect(() => requireGraphQLData({
      errors: [{ message: "Denied" }, { message: "Try another record" }],
    })).toThrow("Denied; Try another record");
    expect(() => requireGraphQLData({})).toThrow(
      "GraphQL response contained no data.",
    );
  });
});
