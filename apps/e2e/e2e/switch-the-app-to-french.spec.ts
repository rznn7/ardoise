import { seedGroupWithInvite } from './fixtures/db';
import { joinWithNewPasskey } from './fixtures/group';
import { expect, test } from './fixtures/test';

test('a member switches the app to French and it stays French', async ({
  passkeyPage: page,
}) => {
  const { token } = await seedGroupWithInvite('Lisbon trip');
  await joinWithNewPasskey(page, token);

  await page.getByRole('link', { name: 'Settings' }).click();
  await page
    .getByRole('group', { name: 'Language' })
    .getByRole('button', { name: 'Français' })
    .click();

  await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Réglages' })).toBeVisible();
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByRole('link', { name: 'Réglages' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Créer un groupe' }),
  ).toBeVisible();
});
