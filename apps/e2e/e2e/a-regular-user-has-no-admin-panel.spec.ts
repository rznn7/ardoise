import { seedGroupWithInvite } from './fixtures/db';
import { joinWithNewPasskey } from './fixtures/group';
import { expect, test } from './fixtures/test';

test('a regular user has no admin panel', async ({ passkeyPage: page }) => {
  const { token } = await seedGroupWithInvite('Lisbon trip');
  await joinWithNewPasskey(page, token);

  await expect(page.getByRole('heading', { name: 'Groups' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/home$/);
});
