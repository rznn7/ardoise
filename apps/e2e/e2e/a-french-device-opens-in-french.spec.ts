import { seedGroupWithInvite } from './fixtures/db';
import { expect, test } from './fixtures/test';

test.use({ locale: 'fr-FR' });

test('a friend on a French phone opens an invite and reads it in French', async ({
  page,
}) => {
  const { token } = await seedGroupWithInvite('Lisbon trip');

  await page.goto(`/join?token=${token}`);

  await expect(
    page.getByRole('heading', { name: 'Lisbon trip' }),
  ).toBeVisible();
  await expect(page.getByText('Vous êtes invité à rejoindre')).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: 'Nouveau ? Rejoindre avec une clé d’accès',
    }),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
});
