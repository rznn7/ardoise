import { makeNewestUserAdmin, seedGroupWithInvite } from './fixtures/db';
import { joinWithNewPasskey } from './fixtures/group';
import { expect, test } from './fixtures/test';

test("an admin sees a user's groups", async ({
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

  await expect(admin.getByText(/^Joined \d{1,2} \S+$/)).toBeVisible();
  await expect(admin.getByText(/passkey/)).toHaveCount(0);
  await expect(admin.getByRole('link', { name: /Lisbon trip/ })).toContainText(
    'Member · 2 members',
  );
  await expect(admin.getByText('Active session')).toBeVisible();
});
