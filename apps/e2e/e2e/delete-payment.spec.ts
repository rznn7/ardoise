import { seedGroupWithInvite } from './fixtures/db';
import {
  addPayment,
  feedRow,
  joinWithNewPasskey,
  openGroup,
} from './fixtures/group';
import { expect, test } from './fixtures/test';

test('a member deletes a payment', async ({ passkeyPage: page }) => {
  const { token } = await seedGroupWithInvite('Lisbon trip');
  await joinWithNewPasskey(page, token);
  await openGroup(page, 'Lisbon trip');
  await addPayment(page, '3,20', 'Coffee');
  await addPayment(page, '18', 'Museum');

  await feedRow(page, 'Coffee').getByRole('link').click();
  await page.getByRole('button', { name: 'Delete' }).click();
  const confirm = page.getByRole('dialog');
  await expect(confirm).toContainText('Delete "Coffee"?');
  const deleted = page.waitForResponse(
    (response) => response.request().method() === 'DELETE',
  );
  await confirm.getByRole('button', { name: 'Delete' }).click();

  await expect(page).toHaveURL(/\/group\/\d+$/);
  await expect(feedRow(page, 'Coffee')).toHaveCount(0);
  expect((await deleted).ok()).toBe(true);

  await page.reload();
  await expect(feedRow(page, 'Museum')).toBeVisible();
  await expect(feedRow(page, 'Coffee')).toHaveCount(0);
});
