import { test, expect } from '@playwright/test';
async function login(page: any, pin?: string) {
  await page.goto('/');
  if (pin) {
    await page.getByLabel('Enter your PIN').fill(pin);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  } else await page.getByRole('button', { name: 'Review as Guest' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
}
test('guest reviews every module; mobile has no page overflow; language persists', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(page);
  for (const route of [
    '/dashboard',
    '/trips',
    '/sales',
    '/expenses',
    '/settlement',
    '/trip-details',
    '/crew',
    '/dues-payables',
    '/chat',
    '/history',
    '/settings',
  ]) {
    await page.goto(route);
    await expect(page.locator('.page-header h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
  }
  await page.goto('/trips/new');
  await expect(page.getByText('Guest access is read only', { exact: true })).toBeVisible();
  const response = await page.request.post('/api/records/messages', {
    headers: { 'X-BoatCore-Client': 'web', 'Idempotency-Key': crypto.randomUUID() },
    data: { text: 'Cannot send' },
  });
  expect(response.status()).toBe(403);
  await page.goto('/trip-details');
  await page.getByRole('link', { name: 'View', exact: true }).first().click();
  await page.getByRole('tab', { name: 'Expenses', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Payment history' })).toBeVisible();
  await page.getByRole('tab', { name: 'History', exact: true }).click();
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'English / தமிழ்' }).click();
  await expect(page.getByRole('heading', { name: 'முகப்பு', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'முகப்பு', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('operator creates trip, derives crew count, records sale, and chats', async ({ page }) => {
  await login(page, '2603');
  await page.goto('/trips/new');
  const name = `Browser voyage ${Date.now()}`;
  await page.getByLabel('Trip name', { exact: true }).fill(name);
  await page.getByLabel('Departure', { exact: true }).fill('2026-11-01');
  await page.getByLabel('Select all', { exact: false }).check();
  await expect(page.getByLabel('Crew count', { exact: true })).toHaveValue('12');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page).toHaveURL(/\/trips$/);
  await page.goto('/sales/new');
  await page.getByLabel('Trip', { exact: true }).selectOption({ label: name });
  await page.getByLabel('Date', { exact: true }).fill('2026-11-02');
  await page.getByLabel('Buyer / Agent', { exact: true }).fill('Browser buyer');
  await page.getByLabel('Bill amount', { exact: true }).fill('1000');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page).toHaveURL(/\/sales$/);
  await expect(page.getByText('Browser buyer', { exact: true }).first()).toBeVisible();
  await page.goto('/chat');
  const msg = `Testing responsive chat ${Date.now()}`;
  await page.getByLabel('Message your team…').fill(msg);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText(msg, { exact: true })).toBeVisible();
  await page.goto('/history');
  await expect(page.getByText('Operator Three', { exact: true }).last()).toBeVisible();
});
