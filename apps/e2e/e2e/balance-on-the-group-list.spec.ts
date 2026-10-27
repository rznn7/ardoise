import { seedGroupWithInvite } from './fixtures/db';
import { addPayment, joinWithNewPasskey, openGroup } from './fixtures/group';
import { expect, test } from './fixtures/test';

test('a member sees their balance on the group list', async ({
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

  await expect(alice.getByRole('link', { name: /Lisbon trip/ })).toContainText(
    '−€15.00',
  );
});
