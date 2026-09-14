import { expect, roleStatePath, test } from "@angee/e2e";

import { NotesPage } from "../pages/notes-page";

test.describe("shared record access", () => {
  test.use({ storageState: roleStatePath("admin") });

  test("a collection shares the selected records through its default toolbar", async ({
    page,
  }) => {
    const notes = new NotesPage(page);
    await notes.gotoReady();

    await expect(notes.shareButton).toBeDisabled();
    const filterBox = await page.getByRole("searchbox", { name: "Filter records" }).boundingBox();
    const shareBox = await notes.shareButton.boundingBox();
    const pagerBox = await page.getByRole("button", { name: "Previous page" }).boundingBox();
    expect(filterBox).not.toBeNull();
    expect(shareBox).not.toBeNull();
    expect(pagerBox).not.toBeNull();
    expect(filterBox!.x).toBeLessThan(shareBox!.x);
    expect(shareBox!.x).toBeLessThan(pagerBox!.x);
    await notes.selectRecords(2);
    await expect(notes.shareButton).toBeEnabled();
    await notes.shareButton.click();

    const dialog = page.getByRole("dialog", {
      name: "Share 2 selected records",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(
      "Manage direct access to the selected records.",
    );
    const access = dialog.getByRole("combobox", { name: "Access" });
    await expect(access).toBeEnabled({ timeout: 20_000 });
    await access.click();
    const accessPositioner = page.locator(".z-popover:visible");
    await expect(accessPositioner).toHaveCSS(
      "z-index",
      "110",
    );
    await expect(dialog).toHaveCSS("z-index", "101");
    await page.getByRole("option", { name: "reader", exact: true }).click();
    await expect(access).toContainText("reader");
  });

  test("tasks inherit the shared collection and record access surfaces", async ({
    page,
  }) => {
    await page.goto("/projects/tasks");
    const share = page.getByRole("button", { name: "Share", exact: true });
    await expect(share).toBeVisible({ timeout: 20_000 });
    await expect(share).toBeDisabled();

    const firstTask = page.getByRole("checkbox", { name: "Select row" }).first();
    const firstGroup = page.locator("tbody tr button[aria-expanded]").first();
    await expect(firstGroup).toBeVisible({ timeout: 20_000 });
    if ((await firstGroup.getAttribute("aria-expanded")) === "false") {
      await firstGroup.click();
    }
    await expect(firstTask).toBeVisible({ timeout: 20_000 });
    await firstTask.click();
    await expect(share).toBeEnabled();
    await share.click();
    const dialog = page.getByRole("dialog", { name: "Share Task" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: "Access" })).toBeEnabled({
      timeout: 20_000,
    });
    await dialog.getByRole("button", { name: "Close" }).click();

    await page.getByRole("link", { name: /^Open / }).first().click();
    await expect(page).toHaveURL(/\/projects\/tasks\/[^/?]+/);
    await expect(page.getByRole("button", {
      name: "Share",
      exact: true,
    })).toHaveCount(1);
  });

  test("record chrome shows one shared action and offers agent service users", async ({
    page,
  }) => {
    const notes = new NotesPage(page);
    await notes.gotoReady();
    await notes.openFirstNote();

    await expect(notes.starButton).toHaveCount(1);
    await expect(notes.shareButton).toHaveCount(1);
    const starBox = await notes.starButton.boundingBox();
    const shareBox = await notes.shareButton.boundingBox();
    expect(starBox).not.toBeNull();
    expect(shareBox).not.toBeNull();
    expect(starBox!.x).toBeLessThan(shareBox!.x);

    await notes.shareButton.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading")).toContainText(/^Share /);
    const recipient = dialog.getByRole("button", {
      name: "Recipient",
      exact: true,
    });
    await recipient.click();
    const demoAgent = page.getByRole("option", {
      name: "Demo Agent",
      exact: true,
    });
    await expect(demoAgent).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("option", { name: "Angee Developer", exact: true }),
    ).toBeVisible();
    await demoAgent.click();
    await expect(dialog.getByRole("button", {
      name: "Recipient: Demo Agent",
      exact: true,
    })).toBeVisible();

    const visibleFields = dialog.getByRole("button", {
      name: "Visible fields",
      exact: true,
    });
    await visibleFields.click();
    const menuPositioner = page.locator(".z-popover:visible");
    await expect(menuPositioner).toHaveCSS("z-index", "110");
    await page.getByRole("menuitemcheckbox", { name: "Access" }).click();
    await expect(dialog.getByRole("button", {
      name: "Sort Access (not sorted)",
      exact: true,
    })).toHaveCount(0);
  });

  test("agent and custom dashboard records inherit the same Share action", async ({
    page,
  }) => {
    await page.goto("/agents");
    const agent = page.getByRole("link", {
      name: "Open Demo Agent",
      exact: true,
    });
    await expect(agent).toBeVisible({ timeout: 20_000 });
    await agent.click();
    await expect(page).toHaveURL(/\/agents\/[^/?]+/);

    const agentShare = page.getByRole("button", {
      name: "Share",
      exact: true,
    });
    await expect(agentShare).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Star" })).toHaveCount(0);
    await agentShare.click();
    const agentDialog = page.getByRole("dialog", { name: "Share Demo Agent" });
    const agentStatus = page.locator("[role='list']").filter({ hasText: "Ready" });
    await expect(agentStatus).toHaveCSS("isolation", "isolate");
    await expect(page.locator(".z-modal-backdrop")).toHaveCSS("z-index", "100");
    await expect(agentDialog).toHaveCSS("z-index", "101");
    await expect(
      agentDialog.getByRole("combobox", { name: "Access" }),
    ).toBeEnabled({ timeout: 20_000 });
    await agentDialog.getByRole("button", { name: "Close" }).click();

    await page.goto("/dashboards");
    const dashboard = page.getByText("Dashboard E2E Verified", { exact: true });
    await expect(dashboard).toBeVisible({ timeout: 20_000 });
    await dashboard.click();
    await expect(page).toHaveURL(/\/dashboards\/[^/?]+/);
    await expect(
      page.getByRole("button", { name: "Share", exact: true }),
    ).toHaveCount(1);
  });

  test("agents, users, and groups share one principal Access surface", async ({
    page,
  }) => {
    const expectAccessSurface = async (): Promise<void> => {
      const access = page.getByRole("tab", { name: "Access", exact: true });
      await expect(access).toBeVisible({ timeout: 20_000 });
      await access.click();

      const roles = page.getByRole("tab", { name: /^Roles \d+$/ });
      const grants = page.getByRole("tab", { name: /^Grants \d+$/ });
      const permissions = page.getByRole("tab", { name: /^Permissions \d+$/ });
      await expect(roles).toBeVisible();
      await expect(grants).toBeVisible();
      await expect(permissions).toBeVisible();

      await grants.click();
      await expect(page.getByRole("button", { name: "Sort Target (not sorted)" })).toBeVisible();
      await permissions.click();
      await expect(page.getByText(/Permission paths reached by effective roles/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Sort Permission (not sorted)" })).toBeVisible();
    };

    await page.goto("/agents");
    const agent = page.getByRole("link", { name: "Open Demo Agent", exact: true });
    await expect(agent).toBeVisible({ timeout: 20_000 });
    await agent.click();
    await expectAccessSurface();

    await page.goto("/iam/users");
    const user = page.getByRole("link", { name: "Open admin", exact: true });
    await expect(user).toBeVisible({ timeout: 20_000 });
    await user.click();
    await expectAccessSurface();

    await page.goto("/iam/groups");
    const group = page.getByRole("link", { name: "Open Admins", exact: true });
    await expect(group).toBeVisible({ timeout: 20_000 });
    await group.click();
    await expect(page.getByRole("tab", { name: "Members", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Bindings", exact: true })).toHaveCount(0);
    await expectAccessSurface();
  });
});
