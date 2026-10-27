import { makeNewestUserAdmin, seedGroupWithInvite } from './fixtures/db';
import { joinWithNewPasskey } from './fixtures/group';
import { expect, test } from './fixtures/test';

test('an admin sees who is on the instance', async ({
  passkeyPage: admin,
  newUserPage,
}) => {
  const { token } = await seedGroupWithInvite('Lisbon trip');
  await joinWithNewPasskey(admin, token);
  await makeNewestUserAdmin();
  const bob = await newUserPage();
  await joinWithNewPasskey(bob, token);
  await admin.reload();

  await admin.getByRole('link', { name: 'Admin' }).click();

  await expect(admin.getByRole('heading', { name: 'Admin' })).toBeVisible();
  await expect(admin.getByRole('link', { name: /^user-/ })).toHaveCount(2);
  await admin.getByRole('button', { name: 'Groups' }).click();
  await expect(admin.getByRole('link', { name: /Lisbon trip/ })).toContainText(
    '2 members · 0 payments · EUR',
  );
});
