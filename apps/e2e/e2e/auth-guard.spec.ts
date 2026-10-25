import { seedGroupWithInvite } from './fixtures/db';
import { expect, test } from './fixtures/test';

test('a visitor without a session is sent to login', async ({ page }) => {
  await page.goto('/home');

  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole('button', { name: 'Login with passkey' }),
  ).toBeVisible();
});

test('a member with a session skips the login page', async ({
  passkeyPage: page,
}) => {
  const { token } = await seedGroupWithInvite('Lisbon trip');
  await page.goto(`/join?token=${token}`);
  await page
    .getByRole('button', { name: 'New here? Join with a passkey' })
    .click();
  await expect(page).toHaveURL(/\/home$/);

  await page.goto('/login');

  await expect(page).toHaveURL(/\/home$/);
});
