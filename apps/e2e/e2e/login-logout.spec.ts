import { seedGroupWithInvite } from './fixtures/db';
import { expect, test } from './fixtures/test';

test('a member logs out and back in with the same passkey and finds their groups', async ({
  passkeyPage: page,
}) => {
  const { token } = await seedGroupWithInvite('Lisbon trip');
  await page.goto(`/join?token=${token}`);
  await page
    .getByRole('button', { name: 'New here? Join with a passkey' })
    .click();
  await expect(page).toHaveURL(/\/home$/);

  const logout = await page.request.post('/api/auth/logout');
  expect(logout.ok()).toBe(true);

  await page.goto('/login');
  await page.getByRole('button', { name: 'Login with passkey' }).click();

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText('Lisbon trip')).toBeVisible();
});
