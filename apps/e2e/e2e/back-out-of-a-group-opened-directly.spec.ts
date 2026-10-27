import { seedGroupWithInvite } from './fixtures/db';
import {
  addPayment,
  feedRow,
  joinWithNewPasskey,
  openGroup,
} from './fixtures/group';
import { expect, test } from './fixtures/test';

test('a member backs out of a group opened from its link and stays in the app', async ({
  passkeyPage: member,
}) => {
  const { token } = await seedGroupWithInvite('Lisbon trip');
  await joinWithNewPasskey(member, token);
  await openGroup(member, 'Lisbon trip');
  await addPayment(member, '12', 'Taxi');

  const page = await member.context().newPage();
  await page.goto(member.url());
  await feedRow(page, 'Taxi').getByRole('link').click();
  await expect(page.getByRole('heading', { name: 'Taxi' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/group\/\d+$/);
  await expect(
    page.getByRole('heading', { name: 'Lisbon trip' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Back to groups' }).click();

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { name: 'ardoise' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Lisbon trip' })).toBeVisible();
});
