import { test, expect, type Page } from "@playwright/test";
import { createFixtureState, executeCommand, snapshot } from "../../packages/domain/src/index";
import { onboardingFor } from "../../packages/domain/src/onboarding";

// Synthetic HTTP fixtures test lineup state and navigation; no provider is contacted.
async function teamFixture(page: Page) {
  const fixture = createFixtureState();
  const answers = onboardingFor(fixture).answers;
  answers.team = [...fixture.activation.selectedTeam];
  answers.systems = [{ id: "shared-website", kind: "website", tool: "Company website", availability: "available", resource: "https://company.example", owner: "Company owner", mapping: "Reviewed company pages", connectionId: "" }];
  await executeCommand(fixture, { type: "save_onboarding", expectedRevision: 0, answers });
  const commands: Array<{ type: string }> = [];
  let failNext = false;
  await page.route("**/api/workspaces", route => route.fulfill({ json: { workspaces: [{ id: fixture.workspace.id, name: fixture.workspace.name }] } }));
  await page.route("**/api/state*", route => route.fulfill({ json: snapshot(fixture) }));
  await page.route("**/api/command*", async route => {
    const command = route.request().postDataJSON();
    commands.push(command);
    if (command.type === "save_onboarding" && failNext) {
      failNext = false;
      await route.fulfill({ status: 503, json: { message: "Synthetic save failure" } });
      return;
    }
    try {
      const result = await executeCommand(fixture, command);
      await route.fulfill({ json: result });
    } catch (error) {
      await route.fulfill({ status: 409, json: { message: error instanceof Error ? error.message : "Synthetic command failure" } });
    }
  });
  const incoming = fixture.catalog.find(agent => !answers.team.includes(agent.id) && agent.supportedArchetypes.includes(fixture.workspace.businessModel))!;
  const outgoing = fixture.catalog.find(agent => agent.id === answers.team[0])!;
  return { fixture, commands, incoming, outgoing, failNextSave: () => { failNext = true; } };
}

async function chooseReplacement(page: Page, incoming: { id: string; name: string }, outgoing: { name: string }) {
  await page.goto("/?view=team");
  await page.getByRole("button", { name: "Build your team", exact: true }).click();
  const card = page.locator(`.builder-agent[data-agent="${incoming.id}"]`);
  await expect(card.locator(".builder-agent-sources")).toContainText("SHARED COMPANY SOURCES");
  await card.getByRole("button", { name: "Swap into team", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: `Swap in ${incoming.name}`, exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^Replace / })).toHaveCount(5);
  await dialog.getByRole("button", { name: `Replace ${outgoing.name}`, exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(5);
  await expect(page.getByRole("button", { name: `Remove ${incoming.name}`, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: `Remove ${outgoing.name}`, exact: true })).toHaveCount(0);
}

test("a full lineup can swap a specialist and save before opening shared company sources", async ({ page }) => {
  const api = await teamFixture(page);
  const systems = structuredClone(api.fixture.onboarding!.answers.systems);
  const connections = structuredClone(api.fixture.connections);
  await chooseReplacement(page, api.incoming, api.outgoing);
  await expect(page.getByRole("button", { name: "Save team", exact: true })).toBeEnabled();
  expect(api.commands).toHaveLength(0);
  await page.getByRole("button", { name: "Manage company sources", exact: true }).click();
  await expect(page).toHaveURL(/view=connections/);
  await expect(page.getByRole("heading", { name: "Connections", exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.has("mode")).toBe(false);
  expect(api.fixture.onboarding!.answers.team).toHaveLength(5);
  expect(api.fixture.onboarding!.answers.team).toContain(api.incoming.id);
  expect(api.fixture.onboarding!.answers.team).not.toContain(api.outgoing.id);
  expect(api.fixture.onboarding!.answers.systems).toEqual(systems);
  expect(api.fixture.connections).toEqual(connections);
  expect(api.commands.map(command => command.type)).toEqual(["save_onboarding"]);
});

test("failed save keeps the replacement draft and does not navigate away", async ({ page }) => {
  const api = await teamFixture(page);
  await chooseReplacement(page, api.incoming, api.outgoing);
  api.failNextSave();
  await page.getByRole("button", { name: "Manage company sources", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Save failed. Your selections are still here" })).toBeVisible();
  await expect(page).toHaveURL(/view=team/);
  await expect(page.getByRole("button", { name: `Remove ${api.incoming.name}`, exact: true })).toBeVisible();
  expect(api.fixture.onboarding!.answers.team).toContain(api.outgoing.id);
  await page.getByRole("button", { name: "Manage company sources", exact: true }).click();
  await expect(page).toHaveURL(/view=connections/);
  expect(api.fixture.onboarding!.answers.team).toContain(api.incoming.id);
});

test("CSV setup link opens the importer once and closing consumes the URL intent", async ({ page }) => {
  await teamFixture(page);
  await page.goto("/?view=opportunities&import=csv");
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Import current proposal records", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has("import")).toBe(false);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Opportunities", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a newer saved lineup preserves the draft but requires explicit reload before overwrite", async ({ page }) => {
  await page.clock.install();
  const api = await teamFixture(page);
  await chooseReplacement(page, api.incoming, api.outgoing);
  const remoteMember = api.fixture.catalog.find(agent => !api.fixture.onboarding!.answers.team.includes(agent.id) && agent.id !== api.incoming.id && agent.supportedArchetypes.includes(api.fixture.workspace.businessModel))!;
  const latest = api.fixture.onboarding!;
  await executeCommand(api.fixture, { type: "save_onboarding", expectedRevision: latest.revision, answers: { ...latest.answers, team: latest.answers.team.map((id, index) => index === 0 ? remoteMember.id : id) } });
  await page.clock.fastForward(31_000);
  await expect(page.getByRole("alert").filter({ hasText: "Team changed in another session." })).toBeVisible();
  await expect(page.getByRole("button", { name: `Remove ${api.incoming.name}`, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save team", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Manage company sources", exact: true })).toBeDisabled();
  expect(api.commands).toHaveLength(0);
  await page.getByRole("button", { name: "Reload saved team", exact: true }).click();
  await expect(page.getByRole("button", { name: `Remove ${remoteMember.name}`, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: `Remove ${api.incoming.name}`, exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Manage company sources", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Save team", exact: true })).toBeDisabled();
});

test("a successful local save clears the draft without presenting a stale-team conflict", async ({ page }) => {
  const api = await teamFixture(page);
  await chooseReplacement(page, api.incoming, api.outgoing);
  await page.getByRole("button", { name: "Save team", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Team saved." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save team", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Reload saved team", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Manage company sources", exact: true }).click();
  await expect(page).toHaveURL(/view=connections/);
  expect(api.commands.map(command => command.type)).toEqual(["save_onboarding"]);
});

test("zero team allowance never opens an empty replacement chooser", async ({ page }) => {
  const api = await teamFixture(page);
  api.fixture.workspace.entitlement = 0;
  api.fixture.onboarding!.answers.team = [];
  await page.goto("/?view=team");
  await page.getByRole("button", { name: "Build your team", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Swap into team", exact: true })).toHaveCount(0);
  await expect(page.locator(`.builder-agent[data-agent="${api.incoming.id}"]`).getByRole("button", { name: "No team slots", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Recommend my five", exact: true })).toBeDisabled();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
