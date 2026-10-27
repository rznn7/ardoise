import { seedGroupWithInvite } from './fixtures/db';
import {
  addPayment,
  feedRow,
  joinWithNewPasskey,
  openGroup,
  pullToRefresh,
} from './fixtures/group';
import { expect, test } from './fixtures/test';

test('pull to refresh shows a payment someone else added', async ({
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
  await expect(feedRow(alice, 'Taxi')).toHaveCount(0);
  await pullToRefresh(alice);

  await expect(feedRow(alice, 'Taxi')).toBeVisible();
});
