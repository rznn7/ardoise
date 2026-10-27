import { expect, type Page } from '@playwright/test';

export async function joinWithNewPasskey(
  page: Page,
  token: string,
): Promise<void> {
  await page.goto(`/join?token=${token}`);
  await page
    .getByRole('button', { name: 'New here? Join with a passkey' })
    .click();
  await expect(page).toHaveURL(/\/home$/);
}

export async function openGroup(page: Page, name: string): Promise<void> {
  await page.getByRole('link', { name }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

export async function startPayment(
  page: Page,
  amount: string,
  title: string,
): Promise<void> {
  await page.getByRole('link', { name: 'Add a payment' }).click();
  await page.getByLabel('Amount').fill(amount);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Title').fill(title);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
}

export async function addPayment(
  page: Page,
  amount: string,
  title: string,
): Promise<void> {
  await startPayment(page, amount, title);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(feedRow(page, title)).toContainText('Paid by you');
}

export function feedRow(page: Page, title: string) {
  return page.getByRole('listitem').filter({ hasText: title });
}

export function heroBalance(page: Page, label: RegExp) {
  return page.getByRole('button', { name: label });
}

export function balancesRow(page: Page, text: RegExp) {
  return page.getByRole('listitem').filter({ hasText: text });
}

export async function confirmRepayment(
  page: Page,
  row: RegExp,
  confirm: RegExp,
): Promise<void> {
  await page.getByRole('button', { name: 'Balances' }).click();
  await page.getByRole('button', { name: row }).click();
  const sheet = page.getByRole('dialog');
  const recorded = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/settlements'),
  );
  await sheet.getByRole('button', { name: confirm }).click();
  expect((await recorded).ok()).toBe(true);
}
