import { test, expect } from "@playwright/test";

test("customer navigation does not include Activation", async ({ page }) => {
  await page.goto("/?view=today");
  await expect(page.getByRole("link", { name: "Today", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Activation", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open Account Intelligence work" })).toContainText("Company positioning profile");
  await expect(page.getByRole("button", { name: "Open Deal Follow-up work" })).toContainText(/proposal/i);
  await expect(page.getByRole("button", { name: "Open Appointment Coordinator work" })).toContainText(/calendar/i);
});

test("all operational screens fit a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const view of [
    "today",
    "team",
    "activation",
    "opportunities",
    "decisions",
    "journey",
    "scenarios",
    "connections",
    "operator",
  ]) {
    await page.goto(`/?view=${view}`);
    await expect(page.locator(".page-heading h1, .briefing-question h1, .studio-heading h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      `${view} must not overflow the page`,
    ).toBe(false);
  }
});

test("Today previews prepared work and opens the exact customer record", async ({
  page,
}) => {
  await page.goto("/?view=opportunities");
  await page
    .getByRole("row")
    .filter({ hasText: "P-1001" })
    .getByRole("button", { name: "Open", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Prepare follow-up", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Approve exact action" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Today", exact: true }).click();
  await expect(page.locator(".message-preview")).toContainText(
    "example.invalid",
  );
  await expect(page.locator(".message-preview")).toContainText("Subject");
  expect(
    await page.locator(".decision-queue > button[aria-pressed]").count(),
  ).toBeLessThanOrEqual(3);
  await page.getByRole("button", { name: "Review exact action" }).click();
  await expect(page).toHaveURL(/view=opportunities.*proposal=/);
  await expect(
    page.getByRole("dialog").getByRole("heading", { level: 2 }),
  ).toContainText("P-1001");
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Approve exact action" }),
  ).toBeVisible();
});

test("agent workspace exposes recorded outputs, sources, limits and working pause controls", async ({
  page,
}) => {
  await page.goto("/?view=today");
  const opener = page.getByRole("button", {
    name: "Open Account Intelligence work",
  });
  await opener.click();
  await expect(page).toHaveURL(/view=team/);
  await expect(page).toHaveURL(/agent=account-intelligence/);
  await expect(
    page.getByRole("region", { name: "Account Intelligence workbench" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Access, limits & history" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("None verified", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Run bounded preparation" }).click();
  await expect(dialog.locator(".prose").first()).toContainText("ILLUSTRATIVE FIXTURE");
  await dialog
    .getByText("Factual inputs & provenance", { exact: true })
    .first()
    .click();
  await expect(dialog.locator(".evidence").first()).toBeVisible();
  await dialog.getByRole("button", { name: "Inputs & access" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Declared tools" }),
  ).toBeVisible();
  await expect(
    dialog.getByText("fixture-website", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Where this work goes" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Rules & limits" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Stop conditions" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Failure & fallback" }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Pause workspace", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Workspace paused", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Work & handoffs" }).click();
  await expect(
    dialog.getByRole("button", { name: "Run bounded preparation" }),
  ).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Copy", exact: true }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Today", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page
      .getByRole("banner")
      .getByRole("img", { name: "David Engine", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Your team", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await expect(
    page.getByRole("link", { name: "Your team", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Switch workspace").selectOption("northstar");
  await expect(page).toHaveURL(/workspace=northstar/);
  await expect(
    page.getByRole("heading", { name: "Today", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});

test("assigned workspace picker preserves isolation through navigation and commands", async ({
  page,
}) => {
  await page.goto("/?view=opportunities");
  await expect(page.getByLabel("Active workspace")).toBeEnabled();
  await page.getByLabel("Active workspace").selectOption("northstar");
  await expect(page.locator(".workspace-chip")).toContainText("northstar");
  await page
    .getByRole("row")
    .filter({ hasText: "P-1001" })
    .getByRole("button", { name: "Open", exact: true })
    .click();
  const request = page.waitForRequest(
    (request) =>
      request.url().includes("/api/command") && request.method() === "POST",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Prepare follow-up", exact: true })
    .click();
  expect(new URL((await request).url()).searchParams.get("workspace")).toBe(
    "northstar",
  );
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Approve exact action" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Today", exact: true }).click();
  await expect(page).toHaveURL(/workspace=northstar/);
  const other = await page.request.get("/api/state?workspace=david");
  expect((await other.json()).actions).toHaveLength(0);
  await page.getByLabel("Active workspace").selectOption("david");
  await expect(page).toHaveURL(/workspace=david/);
  await expect(
    page.getByRole("heading", { name: "Today", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".workspace-chip")).toContainText("DAVID AI");
});

test("fixture source setup explains missing access without fetching real sources", async ({
  page,
}) => {
  const sourceRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/(context\/(capture|confirm)|google\/bind)/.test(request.url()))
      sourceRequests.push(request.url());
  });
  await page.goto("/?view=connections");
  await page.getByRole("button", { name: "Open source setup" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText(/Real source setup is unavailable in fixture mode/),
  ).toBeVisible();
  await expect(dialog.getByLabel("Approved website URL")).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Capture approved website" }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Confirm source-grounded facts" }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Google resources" }).click();
  await expect(dialog.getByLabel("Connected Google account")).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Save binding & queue verification" }),
  ).toBeDisabled();
  await expect(
    dialog.getByText(/Saving queues a read-only capability check/),
  ).toBeVisible();
  expect(sourceRequests).toEqual([]);
});

test("proposal approval, reply, booking and outcome stages remain distinct", async ({
  page,
}) => {
  await page.goto("/?view=opportunities");
  await expect(
    page.getByText("Local demonstrator.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: "P-1001" })
    .getByRole("button", { name: "Open", exact: true })
    .click();
  const drawer = page.getByRole("dialog");
  await drawer
    .getByRole("button", { name: "Prepare follow-up", exact: true })
    .click();
  await drawer
    .getByRole("button", { name: "Approve exact action", exact: true })
    .click();
  await drawer
    .getByRole("button", { name: "Run checked fixture action", exact: true })
    .click();
  await expect(
    drawer.getByText("provider accepted", { exact: false }).first(),
  ).toBeVisible();
  await drawer.getByRole("button", { name: "Record synthetic reply" }).click();
  await drawer
    .getByLabel("Confirmed start (ISO timestamp with offset)")
    .fill("2026-09-14T10:00:00-06:00");
  await drawer
    .getByRole("button", { name: "Prepare appointment for approval" })
    .click();
  await drawer
    .getByRole("button", { name: "Approve exact action", exact: true })
    .click();
  await drawer
    .getByRole("button", { name: "Run checked fixture action", exact: true })
    .click();
  await expect(
    drawer.getByText("confirmed", { exact: true }).first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("link", { name: "Customer journey", exact: true })
    .click();
  await expect(
    page.getByText("1 fixture observation", { exact: true }),
  ).toHaveCount(2);
  await expect(page.getByText("No evidence", { exact: true })).toHaveCount(5);
  await page.getByRole("link", { name: "Today", exact: true }).click();
  await page.screenshot({
    path: "test-results/screenshots/desktop-today.png",
    fullPage: true,
  });
});

test("terminal proposals block outreach, takeover and pause prevent dispatch", async ({
  page,
}) => {
  await page.goto("/?view=opportunities");
  await page
    .getByRole("row")
    .filter({ hasText: "P-1002" })
    .getByRole("button", { name: "Open", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Prepare follow-up", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    /accepted|eligible|status/i,
  );
  await page.keyboard.press("Escape");
  await page
    .getByRole("row")
    .filter({ hasText: "P-1001" })
    .getByRole("button", { name: "Open", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Take over conversation" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Prepare follow-up", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    /takeover|human/i,
  );
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Operator console" }).click();
  await page.getByRole("button", { name: "Pause immediately" }).click();
  await expect(
    page.getByText("Workspace paused.", { exact: true }),
  ).toBeVisible();
});

test("catalog selections, saved scenarios and evidence keyboard navigation", async ({
  page,
}) => {
  await page.goto("/?view=team");
  await page.getByRole("button",{name:"Build your team",exact:true}).click();
  await expect(page.locator(".agent-card")).toHaveCount(32);
  await page.getByRole("button", { name: "Recommend my five" }).click();
  await expect(page.getByRole("status").filter({hasText:"Recommended team selected below"})).toBeVisible();
  await page.getByRole("link", { name: "Scenarios", exact: true }).click();
  await page
    .getByLabel("Scenario name", { exact: true })
    .fill("E2E reviewed planning case");
  await page
    .getByRole("button", { name: "Save scenario", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(/sav|scenario/i);
  await page.reload();
  await expect(page.getByLabel("Scenario name", { exact: true })).toHaveValue(
    "E2E reviewed planning case",
  );
  await page.getByRole("link", { name: "Today", exact: true }).click();
  const metric = page.locator(".metric-card").first();
  await metric.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(metric).toBeFocused();
});

test("mobile navigation and operator forms remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Today", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Operator console" }).click();
  await page
    .getByLabel("Intervention reason / work performed")
    .fill(
      "Reviewed one stale proposal mapping; awaiting source owner confirmation.",
    );
  await page.getByRole("button", { name: "Save time & cost record" }).click();
  await expect(page.getByRole("status")).toContainText(/record|saved|logged/i);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/screenshots/mobile-operator.png",
    fullPage: true,
  });
});

test("activation resumes and preparation leads to a bounded reviewed initiative", async ({
  page,
}) => {
  await page.goto("/?view=activation&mode=profile");
  await page.getByRole("button", { name: /3\. Systems & sources/ }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Systems & sources", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Your team", exact: true }).click();
  await page.getByRole("button",{name:"Build your team",exact:true}).click();
  await page
    .locator(".agent-card")
    .filter({
      has: page.getByRole("heading", {
        name: "Account Intelligence",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Role & readiness" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Run bounded preparation" })
    .click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "No publishing or external account action occurred",
  );
  await expect(page.getByRole("dialog").locator(".prose").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Decisions & initiatives" }).click();
  await page
    .getByRole("button", { name: "Approve initiative" })
    .first()
    .click();
  await expect(page.getByRole("status")).toContainText("Initiative created");
  await page.getByRole("button", { name: "Record review" }).click();
  await expect(page.getByRole("status")).toContainText(/inconclusive/i);
});

test("CSV preview retains source mappings and imported contacts remain unenrolled", async ({
  page,
}) => {
  await page.goto("/?view=opportunities");
  await page.getByRole("button", { name: "Import proposal CSV" }).click();
  const dialog = page.getByRole("dialog");
  const headers =
    "proposal_id,opportunity_id,contact_id,contact_name,email,account,status,owner,version,reference,issued_at,valid_until,amount_minor,currency,value_kind,scope_summary,source_verified_at";
  const row =
    "demo-proposal-1,demo-opportunity-1,demo-contact-1,Test Person,test-csv@example.invalid,Test Advisory,open,Fixture source owner,1,E2E-IMPORT,2026-09-01T16:00:00Z,2026-10-01T16:00:00Z,250000,USD,one_time,Approved factual scope,2026-09-10T16:00:00Z";
  await dialog.getByLabel("CSV content").fill(`${headers}\n${row}`);
  await dialog
    .getByRole("button", { name: "Validate & preview mapping" })
    .click();
  await expect(
    dialog.getByText("1 valid rows · 0 errors", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("cell", { name: "E2E-IMPORT", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Save validated records" }).click();
  await expect(dialog.getByRole("status")).toContainText("not enrolled");
  await page.keyboard.press("Escape");
  await page
    .getByRole("row")
    .filter({ hasText: "E2E-IMPORT" })
    .getByRole("button", { name: "Open", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Prepare follow-up", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    /enroll|CSV|source/i,
  );
});

test("public demo uses isolated sessions, reset and no operational API", async ({
  browser,
}) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  const a = await first.newPage();
  const b = await second.newPage();
  await a.goto("http://localhost:3001");
  await b.goto("http://localhost:3001");
  await expect(a.getByText("Illustrative demo", { exact: true })).toBeVisible();
  await a.getByRole("button", { name: "Explore the numbers" }).click();
  await a.getByLabel("Existing recovery cohort").fill("250");
  await b.getByRole("button", { name: "Explore the numbers" }).click();
  await expect(b.getByLabel("Existing recovery cohort")).toHaveValue("100");
  await b.getByRole("button", { name: "Reset demo" }).click();
  await a.reload();
  await a.getByRole("button", { name: "Explore the numbers" }).click();
  await expect(a.getByLabel("Existing recovery cohort")).toHaveValue("250");
  const response = await a.request.get("http://localhost:3001/api/state");
  expect(response.status()).toBe(404);
  await a.getByLabel("Conversations base conversion percent").fill("120");
  await expect(a.locator(".notice[role=alert]")).toContainText(
    "between 0 and 100",
  );
  await a.getByRole("button", { name: "The experience" }).click();
  await a.screenshot({
    path: "test-results/screenshots/public-demo.png",
    fullPage: true,
  });
  await first.close();
  await second.close();
});
