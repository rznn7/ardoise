import { seedGroupWithInvite } from './fixtures/db';
import {
  addPayment,
  feedRow,
  joinWithNewPasskey,
  openGroup,
} from './fixtures/group';
import { expect, test } from './fixtures/test';

test('details close when someone deletes the payment', async ({
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
  await feedRow(alice, 'Taxi').getByRole('link').click();
  await expect(alice.getByRole('button', { name: 'Delete' })).toBeVisible();

  await feedRow(bob, 'Taxi').getByRole('link').click();
  await bob.getByRole('button', { name: 'Delete' }).click();
  await bob.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

  await expect(alice).toHaveURL(/\/group\/\d+$/);
  await expect(alice.getByText('This payment was deleted')).toBeVisible();
  await expect(feedRow(alice, 'Taxi')).toHaveCount(0);
});
