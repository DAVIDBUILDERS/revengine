import { expect, test } from '@playwright/test';

test('Set up Outbound Email SDR is one question at a time, then offers the next specialist', async ({ page }) => {
  await page.goto('/?view=team');
  await page.getByRole('button', { name: 'Build your team', exact: true }).click();
  await page.getByRole('button', { name: 'Recommend my five', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Recommended team selected below' })).toBeVisible();
  await page.getByLabel('Search the catalog').fill('Outbound Email SDR');
  const emailCard = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Outbound Email SDR', exact: true }) });
  const swap = emailCard.getByRole('button', { name: 'Swap into team' });
  if (await swap.isVisible()) {
    await swap.click();
    await page.getByRole('button', { name: 'Replace Search Growth' }).click();
  } else {
    await expect(emailCard.getByRole('button', { name: 'Selected' })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Save team' }).click();
  await expect(page).toHaveURL(/setup=1/);
  await expect(page).toHaveURL(/agent=outbound-email-sdr/);
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveCount(1);
  await expect(heading).toHaveText('Outbound Email SDR books meetings from your list.');
  await expect(page.getByText('Instantly sub-workspace', { exact: true })).toHaveCount(0);
  await expect(page.getByPlaceholder('Instantly workspace UUID')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
  await page.keyboard.press('Enter');
  await expect(heading).toHaveText('Where should people book a meeting?');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await page.getByLabel('Meeting link').fill('https://meet.example.com/demo');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(heading).toHaveText('Upload the people to email.');
  await expect(page.getByText(/Name the email column email/).first()).toBeVisible();
  await expect(page.getByRole('group', { name: 'Lead CSV drop zone' })).toBeVisible();
  await page.getByRole('group', { name: 'Lead CSV drop zone' }).evaluate((zone) => {
    const file = new File(['email,first name\nlead@example.invalid,Riley\n'], 'leads.csv', { type: 'text/csv' });
    const data = new DataTransfer();
    data.items.add(file);
    const dropped = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(dropped, 'dataTransfer', { value: data });
    zone.dispatchEvent(dropped);
  });
  await expect(page.getByText('leads.csv', { exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'valid lead row' })).toBeVisible();
  await page.setInputFiles('input[type="file"]', {
    name: 'picked.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('email,first name\nsecond@example.invalid,Sam\n'),
  });
  await expect(page.getByText('picked.csv', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(heading).toHaveText('What should these emails be about?');
  await page.getByLabel('Email topic').fill('paid search audits');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(heading).toHaveText('Here is the three-step sequence DAVID will send.');
  await expect(page.getByText(/Drafted as a cold sequence/)).toBeVisible();
  await expect(page.getByText(/paid search audits/).first()).toBeVisible();
  await expect(page.getByText(/dies in a deck/i)).toBeVisible();
  await expect(page.getByText(/who owns paid search audits/i)).toBeVisible();
  await expect(page.getByText(/should I close this out/i)).toBeVisible();
  await expect(page.getByText(/helps your team with|Quick question|Book a conversation|Close the loop/)).toHaveCount(0);
  await expect(page.getByRole('article').filter({ hasText: 'Step 1' })).toBeVisible();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Finish setup' }).click();
  await expect(page.getByRole('heading', { name: 'Outbound Email SDR is set up.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Set up / })).toBeVisible();
});
