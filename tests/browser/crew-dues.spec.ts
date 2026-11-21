import { test, expect } from '@playwright/test';
async function login(page: any, pin = '2601') {
  await page.goto('/');
  await page.getByLabel('Enter your PIN').fill(pin);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
}
test('captain is the only half-share switch; new modules fit the viewport', async ({ page }) => {
  await login(page);
  await page.goto('/settlement');
  await page.getByLabel('Select trip', { exact: true }).selectOption({ index: 1 });
  await expect(page.getByRole('switch', { name: '+0.5', exact: true })).toHaveCount(1);
  for (const path of ['/crew', '/dues-payables']) {
    await page.goto(path);
    await expect(page.locator('.page-header h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.getByRole('button', { name: 'Supplier payables', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Supplier', exact: true })).toBeVisible();
});
test('advance and editable land wages save through responsive dialogs', async ({ page }) => {
  await login(page);
  await page.goto('/crew');
  await page.getByRole('button', { name: 'Add advance', exact: true }).click();
  let modal = page.getByRole('dialog', { name: 'Add advance' });
  await modal.getByLabel('Choose crew', { exact: true }).selectOption({ index: 1 });
  await modal.getByLabel('Amount', { exact: true }).fill('100');
  await modal.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await page.getByRole('button', { name: 'Advances', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Advance', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add wages', exact: true }).click();
  modal = page.getByRole('dialog', { name: 'Add wages' });
  await modal.getByLabel('Select all', { exact: true }).check();
  await modal.getByLabel('Common wage', { exact: true }).fill('300');
  await modal.getByRole('button', { name: 'Apply to selected crew', exact: true }).click();
  await modal.getByLabel('Notes', { exact: true }).fill(`Browser land wages ${Date.now()}`);
  await expect(modal.locator('.wage-total')).toContainText('3,600');
  await modal.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await page.getByRole('button', { name: 'Land wages', exact: true }).click();
  await expect(page.getByText('Browser land wages', { exact: false }).first()).toBeVisible();
});
test('expense entry combines search and selection; sale supports unpaid buyer dues', async ({
  page,
}) => {
  await login(page);
  await page.goto('/expenses/new');
  const product = page.getByRole('combobox', { name: 'Product / item', exact: true });
  await product.fill('Die');
  await page.getByRole('option', { name: 'Diesel', exact: false }).click();
  await expect(product).toHaveValue('Diesel');
  await expect(page.getByLabel('Supplier', { exact: true })).toBeVisible();
  await page.goto('/sales/new');
  await page.getByLabel('Trip', { exact: true }).selectOption({ index: 1 });
  await page.getByLabel('Buyer / Agent', { exact: true }).fill(`Browser due buyer ${Date.now()}`);
  await page.getByLabel('Bill amount', { exact: true }).fill('1000');
  await page.getByRole('switch', { name: 'Fully received', exact: true }).uncheck();
  await page.getByLabel('Received amount', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page).toHaveURL(/\/sales$/);
  await page.goto('/dues-payables');
  await expect(page.getByText('Browser due buyer', { exact: false }).first()).toBeVisible();
});
