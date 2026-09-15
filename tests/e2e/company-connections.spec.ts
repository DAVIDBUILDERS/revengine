import { test, expect, type Page } from '@playwright/test';
import { createFixtureState, executeCommand, snapshot } from '../../packages/domain/src/index';
import { onboardingFor } from '../../packages/domain/src/onboarding';

// Transport fixtures validate the UI; hosted SQL tests cover actual persistence and tenant boundaries.
async function companyFixture(page: Page) {
  const fixture = createFixtureState();
  fixture.onboarding = onboardingFor(fixture);
  fixture.onboarding.answers.team = [];
  fixture.connections = [];
  const present = () => ({ ...snapshot(fixture), workspace: { ...fixture.workspace, mode: 'shadow' }, setupIdentity: { email: 'owner@fixture.invalid', name: 'Fixture owner' } });
  await page.route('**/api/workspaces', route => route.fulfill({ json: { workspaces: [{ id: fixture.workspace.id, name: fixture.workspace.name }] } }));
  await page.route('**/api/state*', route => route.fulfill({ json: present() }));
  await page.route('**/api/command*', async route => {
    try { await executeCommand(fixture, route.request().postDataJSON()); await route.fulfill({ json: { snapshot: present(), message: 'Synthetic save complete' } }); }
    catch (error) { await route.fulfill({ status: 409, json: { message: error instanceof Error ? error.message : 'Save denied' } }); }
  });
  return fixture;
}

test('company setup covers the full roster before team selection and opens source-specific flows', async ({ page }) => {
  const fixture = await companyFixture(page);
  await page.goto('/?view=connections');
  await expect(page.getByRole('heading', { name: 'Connect once. Choose any five.' })).toBeVisible();
  await expect(page.getByText('32 specialist roles', { exact: true })).toBeVisible();
  expect(fixture.onboarding!.answers.team).toEqual([]);
  await page.getByRole('button', { name: 'Set up your website' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Approved website URL', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close details' }).click();
  await page.getByRole('button', { name: 'Set up Gmail' }).click();
  await expect(page.getByLabel(/Gmail send & replies/)).toBeChecked();
  await expect(page.getByRole('button', { name: 'Review Google authorization', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Select all company capabilities' }).click();
  for (const label of ['Selected Sheets', 'Gmail send & replies', 'Owned calendars']) await expect(page.getByLabel(new RegExp(label))).toBeChecked();
  await page.getByRole('button', { name: 'Set up proposal records' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Google Sheets', exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Import proposal CSV' }).click();
  await expect(page).toHaveURL(/view=opportunities/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByText(/CSV/, { exact: false }).first()).toBeVisible();
});

test('inventory and admin help resume without claiming a planned system is connected', async ({ page }) => {
  const fixture = await companyFixture(page);
  await page.goto('/?view=connections');
  await page.getByText('Plan other systems', { exact: true }).click();
  const ads = page.locator('[data-system="advertising"]');
  await expect(ads).toHaveAttribute('data-status', 'engineering_required');
  await ads.getByRole('button', { name: 'Manage system inventory' }).click();
  await expect(page.getByRole('dialog')).toContainText('does not connect LinkedIn, Meta, Shopify');
  await expect(page.getByRole('dialog').getByRole('button', { name: /authorize|sign in|oauth/i })).toHaveCount(0);
  await page.getByLabel('System or tool name').fill('Fixture advertising account');
  await page.getByLabel('Availability', { exact: true }).selectOption('admin_needed');
  await page.getByRole('button', { name: 'Save & request setup help' }).click();
  await expect(page.getByText(/administrator help added to the operator setup queue/)).toBeVisible();
  expect(fixture.onboarding!.tasks).toHaveLength(1);
  expect(fixture.connections).toHaveLength(0);
  await page.reload();
  await page.getByText('Plan other systems', { exact: true }).click();
  await expect(ads).toHaveAttribute('data-status', 'engineering_required');
  await ads.getByRole('button', { name: 'Manage system inventory' }).click();
  await expect(page.getByLabel('System or tool name')).toHaveValue('Fixture advertising account');
  await page.getByRole('button', { name: 'Close details' }).click();
  await page.getByRole('button', { name: 'Choose your five', exact: true }).first().click();
  await expect(page).toHaveURL(/view=team/);
  await expect(page.getByRole('region', { name: 'Team configuration' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('company connections remain readable on mobile with setup gaps visible', async ({ page }) => {
  await companyFixture(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/?view=connections');
  await expect(page.locator('[data-system="website"]')).toHaveAttribute('data-status', 'needs_information');
  await page.screenshot({ path: 'artifacts/company-connections-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/company-connections-mobile.png', fullPage: true });
});
