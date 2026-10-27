import { makeNewestUserAdmin, seedGroupWithInvite } from './fixtures/db';
import { joinWithNewPasskey } from './fixtures/group';
import { expect, test } from './fixtures/test';

test("an admin signs a user's session out", async ({
  passkeyPage: admin,
  newUserPage,
}) => {
  const { token } = await seedGroupWithInvite('Lisbon trip');
  await joinWithNewPasskey(admin, token);
  await makeNewestUserAdmin();
  const bob = await newUserPage();
  await joinWithNewPasskey(bob, token);
  await admin.goto('/admin');
  await admin
    .getByRole('link', { name: /^user-/ })
    .filter({ hasNotText: 'Admin' })
    .click();

  await admin.getByRole('button', { name: 'Revoke' }).click();
  const sheet = admin.getByRole('dialog');
  await expect(sheet).toContainText('Sign this session out?');
  const revoked = admin.waitForResponse((response) =>
    response.url().endsWith('/revoke'),
  );
  await sheet.getByRole('button', { name: 'Revoke' }).click();
  expect((await revoked).ok()).toBe(true);
  await expect(admin.getByText('No active session')).toBeVisible();

  await bob.reload();
  await expect(bob).toHaveURL(/\/login$/);
});
