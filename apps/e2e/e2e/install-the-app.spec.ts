import { expect, test } from './fixtures/test';

interface WebManifest {
  icons: { src: string; sizes: string; purpose: string }[];
}

test('the app can be installed full screen with its icon', async ({ page }) => {
  await page.goto('/');

  const manifestHref = await page
    .locator('link[rel="manifest"]')
    .getAttribute('href');
  expect(manifestHref).not.toBeNull();
  const manifestResponse = await page.request.get(
    new URL(manifestHref ?? '', page.url()).href,
  );
  expect(manifestResponse.ok()).toBe(true);
  const manifest = (await manifestResponse.json()) as WebManifest;
  expect(manifest).toMatchObject({
    name: 'Ardoise',
    short_name: 'Ardoise',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
  });
  expect(manifest.icons.map((icon) => `${icon.sizes} ${icon.purpose}`)).toEqual(
    ['192x192 any', '512x512 any', '512x512 maskable'],
  );

  const appleIcon = await page
    .locator('link[rel="apple-touch-icon"]')
    .getAttribute('href');
  expect(appleIcon).not.toBeNull();
  for (const src of [
    ...manifest.icons.map((icon) => icon.src),
    appleIcon ?? '',
  ]) {
    const response = await page.request.get(new URL(src, page.url()).href);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
  }

  await expect(
    page.locator('meta[name="apple-mobile-web-app-capable"]'),
  ).toHaveAttribute('content', 'yes');
  await expect(
    page.locator('meta[name="apple-mobile-web-app-status-bar-style"]'),
  ).toHaveAttribute('content', 'black-translucent');
});
