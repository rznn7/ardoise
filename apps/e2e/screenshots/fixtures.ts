import { type ExpenseGroupSummary, type MeResponse } from '@ardoise/shared';
import { type Page, type Route } from '@playwright/test';

export const ME: MeResponse = { id: 1, name: 'Gabriel', role: 'user' };

export const GROUPS: ExpenseGroupSummary[] = [
  {
    id: 1,
    name: 'Lisbon trip',
    currencyCode: 'EUR',
    createdAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 2,
    name: 'Flatshare Rue Oberkampf, 3rd floor, left',
    currencyCode: 'EUR',
    createdAt: '2026-09-12T10:00:00.000Z',
  },
  {
    id: 3,
    name: 'Ski 2027',
    currencyCode: 'CHF',
    createdAt: '2026-08-20T10:00:00.000Z',
  },
  {
    id: 4,
    name: 'Friday dinners',
    currencyCode: 'EUR',
    createdAt: '2026-07-03T10:00:00.000Z',
  },
];

export const NEW_GROUP: ExpenseGroupSummary = {
  id: 5,
  name: 'Weekend in Ghent',
  currencyCode: 'EUR',
  createdAt: '2026-10-25T10:00:00.000Z',
};

export type ApiReply =
  | { kind: 'json'; status?: number; body: unknown }
  | { kind: 'status'; status: number }
  | { kind: 'abort' }
  | { kind: 'pending' };

export type ApiMocks = Record<string, ApiReply>;

export const json = (body: unknown, status = 200): ApiReply => ({
  kind: 'json',
  body,
  status,
});
export const status = (code: number): ApiReply => ({
  kind: 'status',
  status: code,
});
export const abort: ApiReply = { kind: 'abort' };
export const pending: ApiReply = { kind: 'pending' };

async function reply(route: Route, apiReply: ApiReply): Promise<void> {
  switch (apiReply.kind) {
    case 'json':
      await route.fulfill({
        status: apiReply.status ?? 200,
        json: apiReply.body,
      });
      return;
    case 'status':
      await route.fulfill({ status: apiReply.status, body: '' });
      return;
    case 'abort':
      await route.abort('failed');
      return;
    case 'pending':
      return;
  }
}

export async function mockApi(page: Page, mocks: ApiMocks): Promise<void> {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, '');
    const key = `${request.method()} ${path}`;
    const match = Object.entries(mocks).find(([pattern]) =>
      new RegExp(`^${pattern}$`).test(key),
    );
    await reply(route, match ? match[1] : status(404));
  });
}
