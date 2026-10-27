import { makeNewestUserAdmin, seedGroupWithInvite } from './fixtures/db';
import { joinWithNewPasskey } from './fixtures/group';
import { expect, test } from './fixtures/test';

test('an admin revokes an invite link', async ({
  passkeyPage: admin,
  page,
}) => {
  const { token } = await seedGroupWithInvite('Lisbon trip');
  await joinWithNewPasskey(admin, token);
  await makeNewestUserAdmin();
  await admin.goto('/admin?tab=groups');
  await admin.getByRole('link', { name: /Lisbon trip/ }).click();

  await admin.getByRole('button', { name: 'Revoke' }).click();
  const sheet = admin.getByRole('dialog');
  await expect(sheet).toContainText('Revoke this link?');
  const revoked = admin.waitForResponse((response) =>
    response.url().endsWith('/revoke'),
  );
  await sheet.getByRole('button', { name: 'Revoke' }).click();
  expect((await revoked).ok()).toBe(true);
  await expect(admin.getByText(/^Revoked /)).toBeVisible();

  await page.goto(`/join?token=${token}`);
  await expect(page.getByText('This invite is no longer valid')).toBeVisible();
});
