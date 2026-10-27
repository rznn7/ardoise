import { makeNewestUserModerator, seedGroupWithInvite } from './fixtures/db';
import { joinWithNewPasskey, openGroup } from './fixtures/group';
import { expect, test } from './fixtures/test';

test('a moderator invites people from an existing group', async ({
  passkeyPage: alice,
  newUserPage,
}) => {
  const { token } = await seedGroupWithInvite('Lisbon trip');
  await joinWithNewPasskey(alice, token);
  await makeNewestUserModerator();
  await openGroup(alice, 'Lisbon trip');

  await alice.getByRole('button', { name: 'Group menu' }).click();
  await alice.getByRole('button', { name: 'Invite people' }).click();
  const inviteInput = alice.getByLabel('Invite link');
  await expect(inviteInput).toHaveValue(/\/join\?token=/);
  const inviteUrl = await inviteInput.inputValue();
  expect(inviteUrl).not.toContain(token);

  const bob = await newUserPage();
  await bob.goto(inviteUrl);
  await expect(bob.getByRole('heading', { name: 'Lisbon trip' })).toBeVisible();
  await bob
    .getByRole('button', { name: 'New here? Join with a passkey' })
    .click();
  await expect(bob).toHaveURL(/\/home$/);
  await expect(bob.getByRole('link', { name: /Lisbon trip/ })).toBeVisible();
});
