import {
  expect,
  grantRecordAccess,
  GraphQLClient,
  loginViaApi,
  PUBLIC_GRAPHQL_PATH,
  requireGraphQLData,
  revokeRecordAccess,
  roleStatePath,
  test,
  type RecordAccessGrant,
} from "@angee/e2e";

interface Principal {
  id: string;
  username: string;
  assignment_subject: string;
}

interface ProposalRow {
  id: string;
  responder: string | null;
  round: { id: string } | null;
}

interface CreatedRecord {
  id: string;
}

const INVENTORY = `
  query ProposalAccessInventory {
    users(limit: 100) { id username assignment_subject }
    agents(limit: 100) { name assignment_subject }
  }
`;

const CREATE_PROJECT = `
  mutation CreateProposalAccessProject($object: projects_insert_input!) {
    insert_projects_one(object: $object) { id }
  }
`;

const DELETE_PROJECT = `
  mutation DeleteProposalAccessProject($id: String!) {
    delete_projects_by_pk(id: $id) { id }
  }
`;

const CREATE_ROUND = `
  mutation CreateProposalAccessRound($object: proposal_rounds_insert_input!) {
    insert_proposal_rounds_one(object: $object) { id }
  }
`;

const CREATE_PROPOSAL = `
  mutation CreateProposalAccessResponse($object: proposals_insert_input!) {
    insert_proposals_one(object: $object) { id }
  }
`;

const PROPOSALS = `
  query ProposalAccessRows {
    proposals(limit: 100) { id responder round { id } }
  }
`;

const DELETE_PROPOSAL = `
  mutation DeleteProposalAccessResponse($id: String!) {
    delete_proposals_by_pk(id: $id) { id }
  }
`;

const DELETE_ROUND = `
  mutation DeleteProposalAccessRound($id: String!) {
    delete_proposal_rounds_by_pk(id: $id) { id }
  }
`;

test("proposal access follows responder seals and the project hierarchy", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const contexts = {
    admin: await browser.newContext({ storageState: roleStatePath("admin") }),
    alice: await browser.newContext({ storageState: roleStatePath("alice") }),
    bob: await browser.newContext({ storageState: roleStatePath("bob") }),
    diego: await browser.newContext(),
  };
  await loginViaApi(contexts.diego.request, {
    username: "diego",
    password: "diego",
  });
  const apis = {
    admin: new GraphQLClient(contexts.admin.request, PUBLIC_GRAPHQL_PATH),
    alice: new GraphQLClient(contexts.alice.request, PUBLIC_GRAPHQL_PATH),
    bob: new GraphQLClient(contexts.bob.request, PUBLIC_GRAPHQL_PATH),
    diego: new GraphQLClient(contexts.diego.request, PUBLIC_GRAPHQL_PATH),
  };
  const adminConsole = new GraphQLClient(
    contexts.admin.request,
    "/graphql/console/",
  );
  let projectId: string | undefined;
  let roundId: string | undefined;
  const proposalIds: string[] = [];
  const grants: RecordAccessGrant[] = [];

  const grant = async (
    targetType: string,
    targetId: string,
    relation: string,
    subject: string,
  ): Promise<void> => {
    grants.push(await grantRecordAccess(adminConsole, {
      targetType,
      targetId,
      relation,
      subject,
    }));
  };

  try {
    const inventory = requireGraphQLData(
      await adminConsole.query<{
        users: Principal[];
        agents: Array<{ name: string; assignment_subject: string }>;
      }>(INVENTORY),
    );
    const principal = (username: string): Principal => {
      const row = inventory.users.find((user) => user.username === username);
      expect(row, `Missing demo user ${username}`).toBeDefined();
      return row!;
    };
    const admin = principal("admin");
    const alice = principal("alice");
    const bob = principal("bob");
    const diego = principal("diego");
    const agent = inventory.agents.find(({ name }) => name === "Demo Agent");
    expect(agent).toBeDefined();

    const now = Date.now();
    projectId = requireGraphQLData<{ insert_projects_one: CreatedRecord }>(
      await apis.admin.query(CREATE_PROJECT, {
        object: { title: `E2E proposal access ${now}` },
      }),
    ).insert_projects_one.id;
    const createdRound = requireGraphQLData(
      await apis.admin.query<{ insert_proposal_rounds_one: CreatedRecord }>(
        CREATE_ROUND,
        {
          object: {
            project: projectId,
            facilitator: admin.id,
            name: `E2E sealed access ${now}`,
            last_call_at: new Date(now).toISOString(),
            submission_deadline: new Date(now + 86_400_000).toISOString(),
          },
        },
      ),
    );
    roundId = createdRound.insert_proposal_rounds_one.id;

    for (const responder of [alice, bob]) {
      await grant(
        "proposals/round",
        roundId,
        "responder",
        responder.assignment_subject,
      );
    }

    for (const [responder, api] of [
      [alice, apis.alice],
      [bob, apis.bob],
    ] as const) {
      const created = requireGraphQLData(
        await api.query<{
          insert_proposals_one: CreatedRecord;
        }>(CREATE_PROPOSAL, {
          object: { round: roundId, responder: responder.id },
        }),
      );
      proposalIds.push(created.insert_proposals_one.id);
    }

    const visible = async (name: "admin" | "alice" | "bob" | "diego") => {
      const rows = requireGraphQLData(
        await apis[name].query<{ proposals: ProposalRow[] }>(PROPOSALS),
      ).proposals;
      return rows.filter((proposal) => proposal.round?.id === roundId);
    };
    expect((await visible("alice")).map((row) => row.responder)).toEqual([
      alice.id,
    ]);
    expect((await visible("bob")).map((row) => row.responder)).toEqual([bob.id]);
    expect(await visible("diego")).toEqual([]);
    expect(new Set((await visible("admin")).map((row) => row.id))).toEqual(
      new Set(proposalIds),
    );

    for (const subject of [diego.assignment_subject, agent!.assignment_subject]) {
      await grant("projects/project", projectId, "proposal_viewer", subject);
    }
    expect(new Set((await visible("diego")).map((row) => row.id))).toEqual(
      new Set(proposalIds),
    );

    for (const name of ["admin", "alice", "bob", "diego"] as const) {
      const page = await contexts[name].newPage();
      await page.goto("/proposals/responses");
      const expectedOwnId = name === "alice" ? proposalIds[0]
        : name === "bob" ? proposalIds[1]
        : proposalIds[0];
      await expect(page.getByRole("link", {
        name: `Open Proposal ${expectedOwnId}`,
        exact: true,
      })).toBeVisible({ timeout: 20_000 });
      for (const id of proposalIds) {
        const link = page.getByRole("link", {
          name: `Open Proposal ${id}`,
          exact: true,
        });
        if (name === "alice" && id === proposalIds[1]) {
          await expect(link).toHaveCount(0);
        } else if (name === "bob" && id === proposalIds[0]) {
          await expect(link).toHaveCount(0);
        } else {
          await expect(link).toBeVisible({ timeout: 20_000 });
        }
      }
    }
  } finally {
    for (const grant of grants.reverse()) {
      await revokeRecordAccess(adminConsole, grant);
    }
    for (const id of proposalIds.reverse()) {
      await apis.admin.query(DELETE_PROPOSAL, { id });
    }
    if (roundId !== undefined) {
      await apis.admin.query(DELETE_ROUND, { id: roundId });
    }
    if (projectId !== undefined) {
      await apis.admin.query(DELETE_PROJECT, { id: projectId });
    }
    await Promise.all(Object.values(contexts).map((context) => context.close()));
  }
});
