import { seedGroupWithInvite } from './fixtures/db';
import {
  addPayment,
  balancesRow,
  confirmRepayment,
  feedRow,
  joinWithNewPasskey,
  openGroup,
} from './fixtures/group';
import { expect, test } from './fixtures/test';

test('a repayment between two other members is read only', async ({
  passkeyPage: alice,
  newUserPage,
}) => {
  const { token } = await seedGroupWithInvite('Lisbon trip');
  await joinWithNewPasskey(alice, token);
  const bob = await newUserPage();
  await joinWithNewPasskey(bob, token);
  const carol = await newUserPage();
  await joinWithNewPasskey(carol, token);
  await openGroup(bob, 'Lisbon trip');
  await addPayment(bob, '30', 'Dinner');
  await alice.reload();
  await openGroup(alice, 'Lisbon trip');
  await confirmRepayment(alice, /^You pay user-/, /^I paid user-.* back$/);

  await openGroup(carol, 'Lisbon trip');
  await carol.getByRole('button', { name: 'Balances' }).click();
  await expect(balancesRow(carol, /^user-.* paid user-.* back/)).toContainText(
    '€10.00',
  );
  await expect(
    carol.getByRole('button', { name: /^user-.* paid user-.* back/ }),
  ).toHaveCount(0);

  await carol.getByRole('button', { name: 'Payments' }).click();
  await feedRow(carol, 'Repayment').getByRole('link').click();
  await expect(
    carol.getByRole('heading', { name: /^user-.* paid user-.* back$/ }),
  ).toBeVisible();
  await expect(
    carol.getByRole('button', { name: 'Undo repayment' }),
  ).toHaveCount(0);
});
