import { test as base, type Page } from '@playwright/test';

import { resetDb } from './db';
import { addVirtualAuthenticator } from './passkey';

interface E2eFixtures {
  cleanDb: void;
  passkeyPage: Page;
  newUserPage: () => Promise<Page>;
}

export const test = base.extend<E2eFixtures>({
  cleanDb: [
    async ({}, use) => {
      await resetDb();
      await use();
    },
    { auto: true },
  ],
  passkeyPage: async ({ page }, use) => {
    await addVirtualAuthenticator(page);
    await use(page);
  },
  newUserPage: async ({ browser }, use) => {
    const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];
    await use(async () => {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      await addVirtualAuthenticator(page);
      return page;
    });
    await Promise.all(contexts.map((context) => context.close()));
  },
});

export { expect } from '@playwright/test';
