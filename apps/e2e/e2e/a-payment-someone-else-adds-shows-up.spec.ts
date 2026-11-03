import { seedGroupWithInvite } from './fixtures/db';
import {
  addPayment,
  feedRow,
  heroBalance,
  joinWithNewPasskey,
  openGroup,
} from './fixtures/group';
import { expect, test } from './fixtures/test';

test('a payment someone else adds shows up without a refresh', async ({
  passkeyPage: alice,
  newUserPage,
}) => {
  const { token } = await seedGroupWithInvite('Lisbon trip');
  await joinWithNewPasskey(alice, token);
  const bob = await newUserPage();
  await joinWithNewPasskey(bob, token);
  await openGroup(alice, 'Lisbon trip');
  await openGroup(bob, 'Lisbon trip');

  await addPayment(bob, '24', 'Taxi');

  await expect(feedRow(alice, 'Taxi')).toBeVisible();
  await expect(heroBalance(alice, /You owe/)).toContainText('€12.00');

  await addPayment(bob, '10', 'Coffee');

  await expect(feedRow(alice, 'Coffee')).toBeVisible();
  await expect(heroBalance(alice, /You owe/)).toContainText('€17.00');
});
