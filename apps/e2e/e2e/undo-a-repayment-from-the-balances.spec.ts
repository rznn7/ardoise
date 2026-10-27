import { seedGroupWithInvite } from './fixtures/db';
import {
  addPayment,
  balancesRow,
  confirmRepayment,
  heroBalance,
  joinWithNewPasskey,
  openGroup,
} from './fixtures/group';
import { expect, test } from './fixtures/test';

test('a member undoes a repayment from the balances', async ({
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

  await alice.getByRole('button', { name: /^You paid user-.* back/ }).click();
  const sheet = alice.getByRole('dialog');
  await expect(sheet).toContainText('€15.00');
  const undone = alice.waitForResponse(
    (response) => response.request().method() === 'DELETE',
  );
  await sheet.getByRole('button', { name: 'Undo repayment' }).click();
  expect((await undone).ok()).toBe(true);

  await expect(heroBalance(alice, /You owe/)).toBeVisible();
  await expect(balancesRow(alice, /^You pay user-/)).toContainText('€15.00');
  await expect(balancesRow(alice, /paid user-.* back/)).toHaveCount(0);
});
