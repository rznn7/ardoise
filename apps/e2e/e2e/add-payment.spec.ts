import { seedGroupWithInvite } from './fixtures/db';
import {
  feedRow,
  joinWithNewPasskey,
  openGroup,
  startPayment,
} from './fixtures/group';
import { expect, test } from './fixtures/test';

test('a member adds a payment with the defaults', async ({
  passkeyPage: page,
}) => {
  const { token } = await seedGroupWithInvite('Lisbon trip');
  await joinWithNewPasskey(page, token);
  await openGroup(page, 'Lisbon trip');

  await page.getByRole('link', { name: 'Add a payment' }).click();
  await page.getByLabel('Amount').fill('24,50');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Title').fill('Pizza');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page).toHaveURL(/\/group\/\d+$/);
  const row = feedRow(page, 'Pizza');
  await expect(row).toContainText('Paid by you');
  await expect(row).toContainText('€24.50');

  await page.reload();
  await expect(feedRow(page, 'Pizza')).toContainText('Paid by you');
  await expect(feedRow(page, 'Pizza')).toContainText('€24.50');
});

test('a member adds a payment split by shares, leaving one member out', async ({
  passkeyPage: alice,
  newUserPage,
}) => {
  const { token } = await seedGroupWithInvite('Lisbon trip');
  await joinWithNewPasskey(alice, token);
  for (let i = 0; i < 2; i++) {
    await joinWithNewPasskey(await newUserPage(), token);
  }
  await openGroup(alice, 'Lisbon trip');

  await startPayment(alice, '30', 'Groceries');
  await alice.getByRole('button', { name: 'Shares' }).click();
  await alice.getByRole('button', { name: 'More shares for You' }).click();
  await alice
    .getByRole('button', { name: /^Fewer shares for / })
    .nth(1)
    .click();
  const rows = alice.getByRole('listitem');
  await expect(rows.nth(0)).toContainText('€20.00');
  await expect(rows.nth(1)).toContainText('—');
  await expect(rows.nth(2)).toContainText('€10.00');
  await alice.getByRole('button', { name: 'Save' }).click();

  await expect(feedRow(alice, 'Groceries')).toContainText('Paid by you');
  await feedRow(alice, 'Groceries').getByRole('link').click();
  await expect(alice.getByText('Paid by you')).toContainText('By shares');
  const shares = alice
    .getByRole('list', { name: 'Shares' })
    .getByRole('listitem');
  await expect(shares.nth(0)).toContainText('You');
  await expect(shares.nth(0)).toContainText('€20.00');
  await expect(shares.nth(1)).toContainText('€0.00');
  await expect(shares.nth(2)).toContainText('€10.00');
});
