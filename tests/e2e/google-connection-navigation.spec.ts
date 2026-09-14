import { test, expect, type Page } from "@playwright/test";
import { createFixtureState, snapshot } from "../../packages/domain/src/index";
import type { ConnectionCapability } from "../../packages/contracts/src/index";

// Synthetic HTTP fixtures verify navigation only; no Google consent or real account is used.
async function syntheticConnectionFixture(page: Page) {
  const fixture = createFixtureState();
  const account: ConnectionCapability = {
    ...fixture.connections[0], provider: "google", identity: "navigation@synthetic.example",
    resource: "Synthetic Google account", health: "unconfigured", lastSyncAt: null, verifiedAt: null,
    scopes: ["openid", "email", ...["drive.file", "gmail.send", "gmail.readonly"].map(name => `https://www.googleapis.com/auth/${name}`)],
    operations: ["sheets.read", "gmail.send", "gmail.read"],
  };
  fixture.connections = [account];
  await page.route("**/api/workspaces", route => route.fulfill({ json: { workspaces: [{ id: fixture.workspace.id, name: "Synthetic navigation workspace" }] } }));
  await page.route("**/api/state*", route => route.fulfill({ json: { ...snapshot(fixture), workspace: { ...fixture.workspace, mode: "shadow" } } }));
  return { fixture, account, reviewUrl: `/?view=connections&workspace=${fixture.workspace.id}&google=review&connection=${account.id}` };
}

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
const experience = (page: Page) => page.getByRole("region", { name: "Google account connection", exact: true });
const authorizeButton = (page: Page) => page.getByRole("button", { name: "Review Google authorization", exact: true });

test("same-page history Back aborts pending Google handoff before a delayed response can redirect", async ({ page }) => {
  await syntheticConnectionFixture(page);
  const pending = deferred();
  let googleNavigations = 0;
  await page.route("https://accounts.google.com/**", route => {
    googleNavigations++;
    return route.fulfill({ contentType: "text/html", body: "<h1>Synthetic Google destination</h1>" });
  });
  await page.route("**/api/google/connect", async route => {
    await pending.promise;
    await route.fulfill({ json: { url: "https://accounts.google.com/o/oauth2/v2/auth?state=synthetic-delayed-navigation" } });
  });
  try {
    await page.goto("/?view=connections");
    await expect(authorizeButton(page)).toBeVisible();
    const documentStartedAt = await page.evaluate(() => performance.timeOrigin);
    // Clicking the current sidebar destination adds history without unmounting Connections.
    await page.getByRole("link", { name: "Connections", exact: true }).click();
    const requestStarted = page.waitForRequest(request => request.url().endsWith("/api/google/connect"));
    await authorizeButton(page).click();
    await requestStarted;
    await expect(experience(page).getByText("Preparing secure handoff", { exact: true })).toBeVisible();
    const aborted = page.waitForEvent("requestfailed", { predicate: request => request.url().endsWith("/api/google/connect") });
    await page.goBack();
    await expect(experience(page).getByRole("button", { name: "Try again with Google" })).toBeVisible();
    pending.release();
    expect((await aborted).failure()?.errorText).toContain("ERR_ABORTED");
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    expect(googleNavigations).toBe(0);
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStartedAt);
    await expect(page).toHaveURL(/\/\?view=connections$/);
    await experience(page).getByRole("button", { name: "Return to connections", exact: true }).click();
    await expect(authorizeButton(page)).toBeEnabled();
  } finally {
    pending.release();
  }
});

test("cancelling a new handoff cannot reopen an earlier source selection drawer", async ({ page }) => {
  const api = await syntheticConnectionFixture(page);
  const pending = deferred();
  let bindings = 0;
  await page.route("**/api/google/bind", route => {
    bindings++;
    return route.fulfill({ json: { message: "Synthetic resource binding" } });
  });
  await page.route("**/api/google/connect", async route => {
    await pending.promise;
    await route.fulfill({ status: 503, json: { message: "Synthetic provider unavailable" } });
  });
  try {
    await page.goto(api.reviewUrl);
    await experience(page).getByRole("button", { name: "Choose a sender" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByLabel("Connected Google account")).toHaveValue(api.account.id);
    await expect(drawer.getByRole("combobox", { name: "Resource type", exact: true })).toHaveValue("mailbox");
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);

    const requestStarted = page.waitForRequest(request => request.url().endsWith("/api/google/connect"));
    await authorizeButton(page).click();
    await requestStarted;
    await expect(experience(page).getByText("Preparing secure handoff", { exact: true })).toBeVisible();
    const aborted = page.waitForEvent("requestfailed", { predicate: request => request.url().endsWith("/api/google/connect") });
    await experience(page).getByRole("button", { name: "Return to connections", exact: true }).click();
    pending.release();
    await aborted;
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(experience(page)).toHaveCount(0);
    await expect(drawer).toHaveCount(0);
    await expect(authorizeButton(page)).toBeFocused();
    await expect(page.getByRole("heading", { name: "Connections", exact: true })).toBeVisible();
    expect(bindings).toBe(0);
    await page.reload();
    await expect(drawer).toHaveCount(0);
    await expect(experience(page)).toHaveCount(0);
  } finally {
    pending.release();
  }
});
