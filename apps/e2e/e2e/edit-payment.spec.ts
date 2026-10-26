import { seedGroupWithInvite } from './fixtures/db';
import {
  addPayment,
  feedRow,
  joinWithNewPasskey,
  openGroup,
} from './fixtures/group';
import { expect, test } from './fixtures/test';

test("a member edits a payment's payer", async ({
  passkeyPage: alice,
  newUserPage,
}) => {
  const { token } = await seedGroupWithInvite('Lisbon trip');
  await joinWithNewPasskey(alice, token);
  await joinWithNewPasskey(await newUserPage(), token);
  await openGroup(alice, 'Lisbon trip');
  await addPayment(alice, '12', 'Taxi');

  await feedRow(alice, 'Taxi').getByRole('link').click();
  await expect(alice.getByRole('heading', { name: 'Taxi' })).toBeVisible();
  await alice.getByRole('button', { name: 'Edit' }).click();
  const paidBy = alice.getByLabel('Paid by');
  const bobName = (await paidBy.locator('option').nth(1).textContent())?.trim();
  if (!bobName) throw new Error('Expected a second member to pick as payer');
  await paidBy.selectOption({ label: bobName });
  const saved = alice.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response.url().includes('/api/payments/'),
  );
  await alice.getByRole('button', { name: 'Save' }).click();

  await expect(alice.getByRole('heading', { name: 'Taxi' })).toBeVisible();
  await expect(alice.getByText(`Paid by ${bobName}`)).toBeVisible();
  expect((await saved).ok()).toBe(true);

  await alice.goBack();
  await expect(alice).toHaveURL(/\/group\/\d+$/);
  await expect(
    alice.getByRole('heading', { name: 'Lisbon trip' }),
  ).toBeVisible();
  await alice.goForward();
  await expect(alice.getByRole('heading', { name: 'Taxi' })).toBeVisible();

  await alice.reload();
  await expect(alice.getByText(`Paid by ${bobName}`)).toBeVisible();
});
