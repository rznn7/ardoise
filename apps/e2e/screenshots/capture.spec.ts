import { expect, type Page, test } from '@playwright/test';

import { mockApi } from './fixtures';
import { CELLS, SIZES, THEMES } from './matrix';

const THEME_STORAGE_KEY = 'ardoise.theme';
const FRENCH_WIDTH = 393;

const LANGUAGES = ['en', 'fr'] as const;
type Language = (typeof LANGUAGES)[number];

const captured = (
  language: Language,
  theme: string,
  size: { width: number },
): boolean =>
  language === 'en' || (theme === 'light' && size.width === FRENCH_WIDTH);

const switchDeviceToFrench = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR'] });
    window.dispatchEvent(new Event('languagechange'));
  });
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
};

for (const cell of CELLS) {
  for (const language of LANGUAGES) {
    for (const theme of THEMES) {
      for (const size of SIZES) {
        if (!captured(language, theme, size)) continue;
        const languagePart = language === 'en' ? '' : `-${language}`;
        const name = `${cell.route}-${cell.state}${languagePart}-${theme}-${String(size.width)}x${String(size.height)}`;

        test(name, async ({ page }) => {
          const errors: Error[] = [];
          page.on('pageerror', (error) => errors.push(error));
          await page.setViewportSize(size);
          await page.addInitScript(
            ([key, value]) => {
              localStorage.setItem(key, value);
            },
            [THEME_STORAGE_KEY, theme] as const,
          );
          await mockApi(page, cell.mocks);

          await page.goto(cell.path);
          await cell.ready(page);
          if (language === 'fr') await switchDeviceToFrench(page);
          await page.evaluate(() => document.fonts.ready);
          await page.waitForFunction(() =>
            Array.from(document.images).every((img) => img.complete),
          );
          await page.waitForTimeout(300);

          await page.screenshot({ path: `screenshots-out/${name}.png` });
          expect(errors).toEqual([]);
        });
      }
    }
  }
}
