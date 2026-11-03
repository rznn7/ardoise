import { seedGroupWithInvite } from './fixtures/db';
import { addPayment, joinWithNewPasskey, openGroup } from './fixtures/group';
import { expect, test } from './fixtures/test';

test("home follows another member's payment", async ({
  passkeyPage: alice,
  newUserPage,
}) => {
  const { token } = await seedGroupWithInvite('Lisbon trip');
  await joinWithNewPasskey(alice, token);
  const bob = await newUserPage();
  await joinWithNewPasskey(bob, token);
  await openGroup(bob, 'Lisbon trip');
  const groupRow = alice.getByRole('link', { name: /Lisbon trip/ });
  await expect(groupRow).toBeVisible();

  await addPayment(bob, '30', 'Dinner');

  await expect(groupRow).toContainText('−€15.00');
});
