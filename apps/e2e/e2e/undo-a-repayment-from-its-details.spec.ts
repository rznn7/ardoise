import { seedGroupWithInvite } from './fixtures/db';
import {
  addPayment,
  confirmRepayment,
  feedRow,
  heroBalance,
  joinWithNewPasskey,
  openGroup,
} from './fixtures/group';
import { expect, test } from './fixtures/test';

test('a member undoes a repayment from its details', async ({
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
  await alice.getByRole('button', { name: 'Payments' }).click();

  await feedRow(alice, 'Repayment').getByRole('link').click();
  await expect(
    alice.getByRole('heading', { name: /^You paid user-.* back$/ }),
  ).toBeVisible();
  await alice.getByRole('button', { name: 'Undo repayment' }).click();
  const confirm = alice.getByRole('dialog');
  await expect(confirm).toContainText('Undo this repayment?');
  await confirm.getByRole('button', { name: 'Undo repayment' }).click();

  await expect(alice).toHaveURL(/\/group\/\d+$/);
  await expect(feedRow(alice, 'Repayment')).toHaveCount(0);
  await expect(heroBalance(alice, /You owe/)).toBeVisible();
});
