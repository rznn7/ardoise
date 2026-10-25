import { expect, test } from '@playwright/test';

import { mockApi } from './fixtures';
import { CELLS, SIZES, THEMES } from './matrix';

const THEME_STORAGE_KEY = 'ardoise.theme';

for (const cell of CELLS) {
  for (const theme of THEMES) {
    for (const size of SIZES) {
      const name = `${cell.route}-${cell.state}-${theme}-${String(size.width)}x${String(size.height)}`;

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
