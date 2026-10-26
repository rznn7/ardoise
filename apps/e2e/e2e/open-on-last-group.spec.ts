import { seedGroupWithInvite } from './fixtures/db';
import { joinWithNewPasskey, openGroup } from './fixtures/group';
import { expect, test } from './fixtures/test';

test('the app opens on the last group, and back returns to the list', async ({
  passkeyPage: page,
}) => {
  const lisbon = await seedGroupWithInvite('Lisbon trip');
  const flatshare = await seedGroupWithInvite('Flatshare');
  await joinWithNewPasskey(page, lisbon.token);
  await page.goto(`/join?token=${flatshare.token}`);
  await page.getByRole('button', { name: 'Join Flatshare' }).click();
  await expect(page).toHaveURL(/\/home$/);

  await openGroup(page, 'Lisbon trip');
  await page.goto('/home');

  await expect(page).toHaveURL(new RegExp(`/group/${String(lisbon.groupId)}$`));
  await expect(
    page.getByRole('heading', { name: 'Lisbon trip' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Back to groups' }).click();

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('link', { name: 'Flatshare' })).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/home$/);
});
