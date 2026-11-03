import { seedGroupWithInvite } from './fixtures/db';
import { joinWithNewPasskey, openGroup } from './fixtures/group';
import { expect, test } from './fixtures/test';

test('a member changes their name and the others see it', async ({
  passkeyPage: alice,
  newUserPage,
}) => {
  const { token } = await seedGroupWithInvite('Lisbon trip');
  await joinWithNewPasskey(alice, token);
  const bob = await newUserPage();
  await joinWithNewPasskey(bob, token);

  await alice.getByRole('link', { name: 'Settings' }).click();
  await expect(
    alice.getByRole('button', { name: /^Name\s*user-/ }),
  ).toBeVisible();
  await alice.getByRole('button', { name: /^Name/ }).click();
  await alice.getByRole('textbox', { name: 'Your name' }).fill('Ana');
  await alice.getByRole('button', { name: 'Save' }).click();
  await expect(
    alice.getByRole('button', { name: /^Name\s*Ana/ }),
  ).toBeVisible();

  await openGroup(bob, 'Lisbon trip');
  await expect(bob.getByText('You, Ana')).toBeVisible();
});
