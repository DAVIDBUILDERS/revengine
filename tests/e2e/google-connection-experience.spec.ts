import { test, expect, type Page } from "@playwright/test";
import { createFixtureState, snapshot } from "../../packages/domain/src/index";
import type { ConnectionCapability } from "../../packages/contracts/src/index";

// Synthetic HTTP responses exercise the UI contract. They do not verify real Google consent.
const scope = (name: string) => `https://www.googleapis.com/auth/${name}`;
async function connectionFixture(page: Page) {
  const fixture = createFixtureState();
  const account: ConnectionCapability = {
    ...fixture.connections[0], provider: "google", identity: "owner@synthetic.example",
    resource: "Google account", health: "unconfigured", lastSyncAt: null, verifiedAt: null,
    scopes: ["openid", "email", scope("drive.file"), scope("gmail.send"), scope("gmail.readonly"), scope("calendar.freebusy"), scope("calendar.events.owned")],
    operations: ["sheets.read", "gmail.send", "gmail.read", "calendar.freebusy", "calendar.book"],
  };
  fixture.connections = [account];
  const present = () => ({ ...snapshot(fixture), workspace: { ...fixture.workspace, mode: "shadow" } });
  await page.route("**/api/workspaces", route => route.fulfill({ json: { workspaces: [{ id: fixture.workspace.id, name: "Synthetic OAuth workspace" }] } }));
  await page.route("**/api/state*", route => route.fulfill({ json: present() }));
  const reviewUrl = () => `/?view=connections&workspace=${fixture.workspace.id}&google=review&connection=${account.id}`;
  return { fixture, account, reviewUrl };
}
const experience = (page: Page) => page.getByRole("region", { name: "Google account connection", exact: true });

test("handoff shows real pending request, selected capabilities, safe redirect and Back recovery", async ({ page }) => {
  const api = await connectionFixture(page);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let request: { workspaceId: string; capabilities: string[] } | undefined;
  await page.route("**/api/google/connect", async route => {
    request = route.request().postDataJSON(); await pending;
    await route.fulfill({ json: { url: "https://accounts.google.com/o/oauth2/v2/auth?state=synthetic-test" } });
  });
  await page.route("https://accounts.google.com/**", route => route.fulfill({ contentType: "text/html", body: "<h1>Synthetic Google destination</h1>" }));
  await page.goto("/?view=connections");
  await page.getByLabel(/Gmail send & replies/).check();
  await page.getByRole("button", { name: "Review Google authorization", exact: true }).click();
  await expect(experience(page).getByText("Preparing secure handoff", { exact: true })).toBeVisible();
  await expect(experience(page).getByRole("heading", { level: 1 })).toBeInViewport();
  await expect(experience(page).getByRole("heading", { name: "Gmail", exact: true })).toBeVisible();
  await expect(experience(page).getByRole("heading", { name: "Google Calendar", exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: "artifacts/google-handoff-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/google-handoff-mobile.png", fullPage: true });
  release();
  await expect(page.getByRole("heading", { name: "Synthetic Google destination" })).toBeVisible();
  expect(request).toEqual({ workspaceId: api.fixture.workspace.id, capabilities: ["sheets", "mail"] });
  await page.goBack();
  await expect(experience(page).getByRole("button", { name: "Try again with Google" })).toBeVisible();
  await experience(page).getByRole("button", { name: "Return to connections", exact: true }).click();
  await expect(page.getByLabel(/Gmail send & replies/)).toBeChecked();
  await page.reload();
  await expect(experience(page)).toHaveCount(0);
});

test("cancel pending handoff ignores a late response and returns keyboard focus", async ({ page }) => {
  await connectionFixture(page);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/google/connect", async route => {
    await pending; await route.fulfill({ json: { url: "https://accounts.google.com/o/oauth2/v2/auth?state=late-synthetic" } });
  });
  await page.goto("/?view=connections");
  await page.getByRole("button", { name: "Review Google authorization", exact: true }).click();
  await expect(experience(page)).toBeVisible();
  await experience(page).getByRole("button", { name: "Return to connections", exact: true }).click();
  release();
  await expect(page.getByRole("button", { name: "Review Google authorization", exact: true })).toBeFocused();
  await expect(experience(page)).toHaveCount(0);
  await page.reload();
  await expect(experience(page)).toHaveCount(0);
});

test("return uses actual grants, opens exact source account, and never activates work", async ({ page }) => {
  const api = await connectionFixture(page);
  let bindings = 0;
  let binding: Record<string, unknown> | undefined;
  await page.route("**/api/google/bind", route => { bindings++; binding = route.request().postDataJSON(); return route.fulfill({ json: { message: "Synthetic verification queued" } }); });
  await page.goto(api.reviewUrl());
  await expect(experience(page).getByRole("heading", { name: "Your account. Your control." })).toBeVisible();
  await expect(experience(page).getByRole("heading", { name: api.account.identity })).toBeVisible();
  await expect(experience(page).getByText("Source verification pending", { exact: true })).toBeVisible();
  for (const name of ["Choose a Sheet", "Choose a sender", "Choose a calendar"]) await expect(experience(page).getByRole("button", { name })).toBeEnabled();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: "artifacts/google-return-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/google-return-mobile.png", fullPage: true });
  await experience(page).getByRole("button", { name: "Choose a sender" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Connected Google account")).toHaveValue(api.account.id);
  await expect(dialog.getByRole("combobox", { name: "Resource type", exact: true })).toHaveValue("mailbox");
  await expect(dialog.getByLabel("Approved mailbox identity")).toBeVisible();
  await page.screenshot({ path: "artifacts/google-source-mobile.png" });
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(bindings).toBe(0);
  await dialog.getByLabel("Approved mailbox identity").fill(api.account.identity);
  await dialog.getByLabel("Responsible source owner").fill("Synthetic source owner");
  await dialog.getByRole("button", { name: "Save binding & queue verification" }).click();
  await expect(dialog).toContainText("Synthetic verification queued");
  expect(bindings).toBe(1);
  expect(binding).toMatchObject({ workspaceId: api.fixture.workspace.id, connectionId: api.account.id, resourceType: "mailbox", resourceId: api.account.identity, owner: "Synthetic source owner", range: null, mapping: {} });
  await expect(page).not.toHaveURL(/google=|connection=/);
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(experience(page)).toHaveCount(0);
});

test("partial grants, revoked connections and unrelated IDs cannot claim usable access", async ({ page }) => {
  const api = await connectionFixture(page);
  api.account.scopes = ["openid", "email", scope("gmail.send")];
  api.account.operations = ["gmail.send"];
  await page.goto(api.reviewUrl());
  const gmail = experience(page).locator(".google-experience-permission").filter({ has: page.getByRole("heading", { name: "Gmail", exact: true }) });
  await expect(gmail).toContainText("Partial access");
  await expect(gmail.getByRole("button", { name: "Choose a sender" })).toBeDisabled();
  let requested: string[] = [];
  await page.route("**/api/google/connect", route => { requested = route.request().postDataJSON().capabilities; return route.fulfill({ status: 503, json: { message: "Synthetic provider unavailable" } }); });
  await gmail.getByRole("button", { name: /Review permissions in Google/ }).click();
  await expect(experience(page)).toContainText("Synthetic provider unavailable");
  expect(requested).toContain("mail");
  api.account.health = "revoked";
  await page.goto(api.reviewUrl());
  await expect(experience(page)).toContainText("Access revoked");
  await expect(experience(page).getByRole("button", { name: "Choose a sender" })).toBeDisabled();
  await page.goto(api.reviewUrl().replace(api.account.id, "00000000-0000-4000-8000-000000000009"));
  await expect(experience(page)).toContainText("No account confirmed");
  await expect(experience(page).getByRole("heading", { name: api.account.identity })).toHaveCount(0);
  api.account.workspaceId = "00000000-0000-4000-8000-000000000008";
  await page.goto(api.reviewUrl());
  await expect(experience(page)).toContainText("No account confirmed");
});

test("failed and expired returns recover cleanly; viewer cannot authorize or bind", async ({ page }) => {
  const api = await connectionFixture(page);
  for (const outcome of ["cancelled", "expired", "failed"]) {
    await page.goto(`/?view=connections&google=${outcome}`);
    await expect(experience(page)).toBeVisible();
    await experience(page).getByRole("button", { name: "Return to connections", exact: true }).click();
    await page.reload();
    await expect(experience(page)).toHaveCount(0);
  }
  api.fixture.context.role = "workspace_viewer";
  await page.goto(api.reviewUrl());
  await expect(experience(page).getByRole("button", { name: "Choose a Sheet" })).toBeDisabled();
  await experience(page).getByRole("button", { name: "Return to connections", exact: true }).click();
  await expect(page.getByRole("button", { name: "Review Google authorization", exact: true })).toBeDisabled();
});

test("unexpected authorization destination stays in DAVID with retry", async ({ page }) => {
  await connectionFixture(page);
  await page.route("**/api/google/connect", route => route.fulfill({ json: { url: "https://untrusted.example/oauth" } }));
  await page.goto("/?view=connections");
  await page.getByRole("button", { name: "Review Google authorization", exact: true }).click();
  await expect(experience(page)).toContainText("An unexpected authorization destination was rejected.");
  await expect(experience(page).getByRole("button", { name: "Reconnect with Google" })).toBeEnabled();
  await expect(page).toHaveURL(/localhost:3000/);
});
