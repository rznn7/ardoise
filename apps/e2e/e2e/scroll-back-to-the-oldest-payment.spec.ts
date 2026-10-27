import { seedGroupWithInvite, seedPayments } from './fixtures/db';
import {
  feedRow,
  joinWithNewPasskey,
  openGroup,
  scrollToBottom,
} from './fixtures/group';
import { expect, test } from './fixtures/test';

test('scroll back to the oldest payment', async ({ passkeyPage: alice }) => {
  const { groupId, token } = await seedGroupWithInvite('Flatshare');
  await joinWithNewPasskey(alice, token);
  await seedPayments(groupId, 60, 'First groceries');
  await openGroup(alice, 'Flatshare');
  const oldest = feedRow(alice, 'First groceries');
  await expect(oldest).toHaveCount(0);

  await expect(async () => {
    await scrollToBottom(alice);
    await expect(oldest).toBeInViewport({ timeout: 1000 });
  }).toPass();
  await oldest.click();
  await expect(
    alice.getByRole('heading', { name: 'First groceries' }),
  ).toBeVisible();
  await alice.goBack();

  await expect(oldest).toBeInViewport();
});
