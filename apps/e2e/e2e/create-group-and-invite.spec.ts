import { seedGroupWithInvite } from './fixtures/db';
import { expect, test } from './fixtures/test';

test('a member creates a group and a friend joins it from the shared link', async ({
  passkeyPage: alice,
  newUserPage,
}) => {
  const { token } = await seedGroupWithInvite('Lisbon trip');
  await alice.goto(`/join?token=${token}`);
  await alice
    .getByRole('button', { name: 'New here? Join with a passkey' })
    .click();
  await expect(alice).toHaveURL(/\/home$/);

  await alice.getByRole('button', { name: 'Create a group' }).click();
  await alice.getByLabel('Group name').fill('Flatshare');
  await alice.getByRole('button', { name: 'Create', exact: true }).click();
  const inviteInput = alice.getByLabel('Invite link');
  await expect(inviteInput).toHaveValue(/\/join\?token=/);
  const inviteUrl = await inviteInput.inputValue();

  const bob = await newUserPage();
  await bob.goto(inviteUrl);
  await expect(bob.getByRole('heading', { name: 'Flatshare' })).toBeVisible();
  await bob
    .getByRole('button', { name: 'New here? Join with a passkey' })
    .click();
  await expect(bob).toHaveURL(/\/home$/);
  await expect(bob.getByText('Flatshare')).toBeVisible();

  await alice.reload();
  await expect(alice.getByText('Lisbon trip')).toBeVisible();
  await expect(alice.getByText('Flatshare')).toBeVisible();
});
