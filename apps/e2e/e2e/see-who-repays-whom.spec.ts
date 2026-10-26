import { seedGroupWithInvite } from './fixtures/db';
import {
  addPayment,
  heroBalance,
  joinWithNewPasskey,
  openGroup,
} from './fixtures/group';
import { expect, test } from './fixtures/test';

test('a member sees who repays whom', async ({
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

  await heroBalance(alice, /You owe/).click();

  await expect(alice).toHaveURL(/\/group\/\d+\?tab=balances$/);
  const repayment = alice
    .getByRole('listitem')
    .filter({ hasText: /^You pay user-/ });
  await expect(repayment).toContainText('€15.00');

  await alice.reload();
  await expect(repayment).toContainText('€15.00');

  await alice.goBack();
  await expect(alice).toHaveURL(/\/home$/);
});
