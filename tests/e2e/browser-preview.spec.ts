import { expect, test } from "@playwright/test";

const origin = process.env.PREVIEW_URL ?? "http://localhost:3002";
test("hosted workspace works without an operational API and survives refresh", async ({ page, browser }) => {
  const errors: string[] = [];
  const requests: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (["fetch", "xhr"].includes(request.resourceType()) && !request.url().includes("__next")) requests.push(request.url());
  });
  await page.goto(origin);
  await expect(page.getByText("Browser demo.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open Account Intelligence workspace" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Run bounded preparation" }).click();
  await expect(dialog.locator(".prose")).toContainText("ILLUSTRATIVE FIXTURE");
  await dialog.getByRole("button", { name: "Rules & limits" }).click();
  await dialog.getByRole("button", { name: "Pause workspace", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Workspace paused", exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.locator(".page-heading h1, .briefing-question h1")).toBeVisible();
  await page.getByRole("button", { name: "Open Account Intelligence workspace" }).click();
  await dialog.getByRole("button", { name: "Rules & limits" }).click();
  await expect(dialog.getByRole("button", { name: "Workspace paused", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const view of ["today", "team", "activation", "opportunities", "decisions", "journey", "scenarios", "connections", "operator"]) {
    await page.goto(`${origin}/?view=${view}`);
    await expect(page.locator(".page-heading h1, .briefing-question h1")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), view).toBe(false);
  }
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto(origin);
  await otherPage.getByRole("button", { name: "Open Account Intelligence workspace" }).click();
  await otherPage.getByRole("dialog").getByRole("button", { name: "Rules & limits" }).click();
  await expect(otherPage.getByRole("dialog").getByRole("button", { name: "Pause workspace", exact: true })).toBeEnabled();
  await other.close();
  expect((await page.request.get(`${origin}/api/state`)).status()).toBe(404);
  expect((await page.request.post(`${origin}/api/command`, { data: { type: "reset" } })).status()).toBeGreaterThanOrEqual(400);
  expect(errors).toEqual([]);
  expect(requests).toEqual([]);
});
