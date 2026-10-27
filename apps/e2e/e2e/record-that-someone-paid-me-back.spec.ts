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

test('a member records that someone paid them back', async ({
  passkeyPage: alice,
  newUserPage,
}) => {
  const { token } = await seedGroupWithInvite('Lisbon trip');
  await joinWithNewPasskey(alice, token);
  const bob = await newUserPage();
  await joinWithNewPasskey(bob, token);
  await alice.reload();
  await openGroup(alice, 'Lisbon trip');
  await addPayment(alice, '30', 'Dinner');

  await confirmRepayment(alice, /^user-.* pays you/, /^user-.* paid me back$/);

  await expect(heroBalance(alice, /Settled up/)).toBeVisible();
  await expect(balancesRow(alice, /^user-.* paid you back/)).toContainText(
    '€15.00',
  );

  await openGroup(bob, 'Lisbon trip');
  await expect(heroBalance(bob, /Settled up/)).toBeVisible();
});
