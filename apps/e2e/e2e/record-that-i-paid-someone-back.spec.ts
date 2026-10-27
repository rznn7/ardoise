import { seedGroupWithInvite } from './fixtures/db';
import {
  addPayment,
  balancesRow,
  confirmRepayment,
  feedRow,
  heroBalance,
  joinWithNewPasskey,
  openGroup,
} from './fixtures/group';
import { expect, test } from './fixtures/test';

test('a member records that they paid someone back', async ({
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

  await confirmRepayment(alice, /^You pay user-/, /^I paid user-.* back$/);

  await expect(heroBalance(alice, /Settled up/)).toBeVisible();
  await expect(balancesRow(alice, /^You pay user-/)).toHaveCount(0);
  await expect(balancesRow(alice, /^You paid user-.* back/)).toContainText(
    '€15.00',
  );

  await alice.getByRole('button', { name: 'Payments' }).click();
  await expect(feedRow(alice, 'Repayment')).toContainText(
    /You paid user-.* back/,
  );

  await alice.reload();
  await expect(heroBalance(alice, /Settled up/)).toBeVisible();
});
