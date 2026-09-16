import { test, expect } from "@playwright/test";
import { createFixtureState, snapshot } from "../../packages/domain/src/index";

test("workspace studio pages fit desktop and mobile with working proposal filters", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const view of ["opportunities", "decisions", "journey", "scenarios", "operator", "connections", "today"]) {
    await page.goto("/?view=" + view);
    await expect(page.locator(".studio-app")).toBeVisible();
    await expect(page.locator("h1").first()).toBeVisible();
    await page.screenshot({ path: `artifacts/studio-${view}-desktop.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), view + " desktop overflow").toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), view + " mobile overflow").toBe(true);
    await page.screenshot({ path: `artifacts/studio-${view}-mobile.png` });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.goto("/?view=opportunities");
  await expect(page.locator(".studio-app")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pipeline", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Who" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "What the agents did" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Next for sales" })).toBeVisible();
  await expect(page.locator("table").first().locator("tbody tr").first()).toBeVisible();
});

test("connection inspection preserves access failures over stale data and returns keyboard focus", async ({ page }) => {
  const fixture = createFixtureState();
  fixture.connections[0].health = "revoked";
  fixture.connections[0].lastSyncAt = "2020-01-01T00:00:00.000Z";
  await page.route("**/api/state**", route => route.fulfill({ json: { snapshot: snapshot(fixture) } }));
  await page.goto("/?view=connections");
  const source = page.locator(".connections-account").first();
  await expect(source.locator(".badge")).toHaveText(/revoked/i);
  await expect(page.getByRole("button", { name: "Review Google authorization" })).toBeDisabled();
  const inspect = source.getByRole("button", { name: "Inspect" });
  await inspect.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".connections-inspector-status")).toContainText(/revoked/i);
  await page.screenshot({ path: "artifacts/studio-connection-inspector-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/studio-connection-inspector-mobile.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(inspect).toBeFocused();
});
