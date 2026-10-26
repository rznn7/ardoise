import { seedGroupWithInvite } from './fixtures/db';
import {
  addPayment,
  heroBalance,
  joinWithNewPasskey,
  openGroup,
} from './fixtures/group';
import { expect, test } from './fixtures/test';

test('the balance updates after adding a payment', async ({
  passkeyPage: alice,
  newUserPage,
}) => {
  const { token } = await seedGroupWithInvite('Lisbon trip');
  await joinWithNewPasskey(alice, token);
  await joinWithNewPasskey(await newUserPage(), token);
  await openGroup(alice, 'Lisbon trip');

  await addPayment(alice, '30', 'Dinner');

  await expect(heroBalance(alice, /Owed to you/)).toContainText('€15.00');
});
