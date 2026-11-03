import { seedGroupWithInvite } from './fixtures/db';
import { joinWithNewPasskey } from './fixtures/group';
import { expect, test } from './fixtures/test';

test('a member signs out from settings and back in with the same passkey', async ({
  passkeyPage: page,
}) => {
  const { token } = await seedGroupWithInvite('Lisbon trip');
  await joinWithNewPasskey(page, token);

  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  const confirm = page.getByRole('dialog');
  await expect(confirm).toContainText('Sign out?');
  await confirm.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto('/home');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByRole('button', { name: 'Login with passkey' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText('Lisbon trip')).toBeVisible();
});
