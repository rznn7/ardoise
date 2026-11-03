import { seedGroupWithInvite } from './fixtures/db';
import { expect, test } from './fixtures/test';

test('a newcomer joins a group from an invite link with their name and a new passkey', async ({
  passkeyPage: page,
}) => {
  const { token } = await seedGroupWithInvite('Lisbon trip');

  await page.goto(`/join?token=${token}`);
  await expect(
    page.getByRole('heading', { name: 'Lisbon trip' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'New here? Join with a passkey' })
    .click();
  await page.getByLabel('Your name').fill('Ana');
  await page.getByRole('button', { name: 'Create passkey' }).click();

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText('Lisbon trip')).toBeVisible();
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('button', { name: /^Name\s*Ana/ })).toBeVisible();
});
