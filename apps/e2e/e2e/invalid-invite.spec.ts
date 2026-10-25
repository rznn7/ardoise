import { expireInvite, seedGroupWithInvite } from './fixtures/db';
import { expect, test } from './fixtures/test';

test('an unknown invite link explains itself instead of failing', async ({
  page,
}) => {
  await page.goto(`/join?token=${'x'.repeat(43)}`);

  await expect(page.getByText('This invite is no longer valid')).toBeVisible();
});

test('an expired invite link explains itself', async ({ page }) => {
  const { token } = await seedGroupWithInvite('Lisbon trip');
  await expireInvite(token);

  await page.goto(`/join?token=${token}`);

  await expect(page.getByText('This invite is no longer valid')).toBeVisible();
});
