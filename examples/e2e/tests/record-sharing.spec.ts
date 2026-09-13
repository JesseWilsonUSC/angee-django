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
    await expect(
      dialog.getByRole("combobox", { name: "Access" }),
    ).toBeEnabled({ timeout: 20_000 });
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
    await dialog
      .getByRole("button", { name: "Recipient", exact: true })
      .click();
    await expect(
      page.getByRole("option", { name: "Demo Agent", exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("option", { name: "Angee Developer", exact: true }),
    ).toBeVisible();
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
});
