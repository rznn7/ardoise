import { seedGroupWithInvite } from './fixtures/db';
import {
  addPayment,
  heroBalance,
  joinWithNewPasskey,
  openGroup,
} from './fixtures/group';
import { expect, test } from './fixtures/test';

test('a member sees what they owe in a group', async ({
  passkeyPage: alice,
  newUserPage,
}) => {
  const { token } = await seedGroupWithInvite('Lisbon trip');
  await joinWithNewPasskey(alice, token);
  const bob = await newUserPage();
  await joinWithNewPasskey(bob, token);
  await openGroup(bob, 'Lisbon trip');
  await addPayment(bob, '30', 'Dinner');

  await alice.reload();
  await openGroup(alice, 'Lisbon trip');

  const balance = heroBalance(alice, /You owe/);
  await expect(balance).toContainText('€15.00');
});
