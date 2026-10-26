import { expect, type Page } from '@playwright/test';

import {
  abort,
  type ApiMocks,
  GROUP,
  GROUPS,
  json,
  ME,
  MEMBERS,
  NEW_GROUP,
  PAYMENTS,
  pending,
  SHARES,
  status,
} from './fixtures';

export interface ScreenshotCell {
  route: string;
  state: string;
  path: string;
  mocks: ApiMocks;
  ready: (page: Page) => Promise<void>;
}

const loggedIn: ApiMocks = { 'POST /auth/me': json(ME) };
const loggedOut: ApiMocks = { 'POST /auth/me': status(401) };
const PREVIEW = 'GET /invite-link/[^/]+/preview';
const GROUPS_LIST = 'GET /expense-groups';
const GROUP_PATH = `/group/${String(GROUP.id)}`;
const GROUP_FEED = `GET /expense-groups/${String(GROUP.id)}/payments`;
const INVITE_TOKEN = 'aGVsbG8td29ybGQtdGhpcy1pcy1hLWRlbW8tdG9rZW4';
const [DETAILED_PAYMENT] = PAYMENTS;
if (DETAILED_PAYMENT === undefined) throw new Error('PAYMENTS is empty');
const DETAILS_PATH = `${GROUP_PATH}/payments/${String(DETAILED_PAYMENT.id)}`;

const groupMocks: ApiMocks = {
  ...loggedIn,
  [`GET /expense-groups/${String(GROUP.id)}`]: json(GROUP),
  [`GET /expense-groups/${String(GROUP.id)}/members`]: json(MEMBERS),
  [GROUP_FEED]: json(PAYMENTS),
  [`GET /payments/${String(DETAILED_PAYMENT.id)}`]: json(DETAILED_PAYMENT),
  [`GET /payment-shares/by-payment/${String(DETAILED_PAYMENT.id)}`]:
    json(SHARES),
  'POST /invite-link': json({ token: INVITE_TOKEN }, 201),
};

const visible = (text: string | RegExp) => async (page: Page) => {
  await expect(page.getByText(text).first()).toBeVisible();
};

const loadingStatus = async (page: Page): Promise<void> => {
  await expect(
    page.getByRole('status', { name: 'Loading' }).first(),
  ).toBeVisible();
};

const groupLoaded = async (page: Page): Promise<void> => {
  await expect(page.getByRole('heading', { name: GROUP.name })).toBeVisible();
};

const amountTyped = async (page: Page): Promise<void> => {
  await page.getByLabel('Amount').fill('24,50');
};

const toTitle = async (page: Page): Promise<void> => {
  await amountTyped(page);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Title').fill('Pizza');
};

const toOptions = async (page: Page): Promise<void> => {
  await toTitle(page);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
};

const splitBy =
  (mode: string, fill: (page: Page) => Promise<void>) =>
  async (page: Page): Promise<void> => {
    await toOptions(page);
    await page.getByRole('button', { name: mode, exact: true }).click();
    await fill(page);
  };

const fillEach = async (
  page: Page,
  suffix: string,
  values: readonly string[],
): Promise<void> => {
  const fields = page.getByRole('textbox', { name: new RegExp(`${suffix}$`) });
  for (const [index, value] of values.entries()) {
    await fields.nth(index).fill(value);
  }
};

const openCreateSheet = async (page: Page): Promise<void> => {
  await expect(page.getByText('Lisbon trip')).toBeVisible();
  await page.getByRole('button', { name: 'Create a group' }).click();
  await expect(
    page.getByRole('heading', { name: 'Create a group' }),
  ).toBeVisible();
};

export const CELLS: ScreenshotCell[] = [
  {
    route: 'login',
    state: 'idle',
    path: '/login',
    mocks: loggedOut,
    ready: visible('Login with passkey'),
  },
  {
    route: 'join',
    state: 'loading',
    path: '/join?token=demo',
    mocks: { ...loggedOut, [PREVIEW]: pending },
    ready: async (page) => {
      await expect(page.locator('hlm-spinner')).toBeVisible();
    },
  },
  {
    route: 'join',
    state: 'logged-out',
    path: '/join?token=demo',
    mocks: { ...loggedOut, [PREVIEW]: json({ groupName: 'Lisbon trip' }) },
    ready: visible('New here? Join with a passkey'),
  },
  {
    route: 'join',
    state: 'logged-out-long-name',
    path: '/join?token=demo',
    mocks: {
      ...loggedOut,
      [PREVIEW]: json({
        groupName: 'Flatshare Rue Oberkampf, 3rd floor, left',
      }),
    },
    ready: visible('New here? Join with a passkey'),
  },
  {
    route: 'join',
    state: 'logged-in',
    path: '/join?token=demo',
    mocks: { ...loggedIn, [PREVIEW]: json({ groupName: 'Lisbon trip' }) },
    ready: visible('Join Lisbon trip'),
  },
  {
    route: 'join',
    state: 'invalid',
    path: '/join?token=demo',
    mocks: { ...loggedOut, [PREVIEW]: status(404) },
    ready: visible('This invite is no longer valid'),
  },
  {
    route: 'join',
    state: 'could-not-load',
    path: '/join?token=demo',
    mocks: { ...loggedOut, [PREVIEW]: abort },
    ready: visible("Couldn't load this invite"),
  },
  {
    route: 'home',
    state: 'loading',
    path: '/home',
    mocks: { ...loggedIn, [GROUPS_LIST]: pending },
    ready: loadingStatus,
  },
  {
    route: 'home',
    state: 'empty',
    path: '/home',
    mocks: { ...loggedIn, [GROUPS_LIST]: json([]) },
    ready: visible('No groups yet'),
  },
  {
    route: 'home',
    state: 'error',
    path: '/home',
    mocks: { ...loggedIn, [GROUPS_LIST]: status(500) },
    ready: visible("Couldn't load your groups"),
  },
  {
    route: 'home',
    state: 'filled',
    path: '/home',
    mocks: { ...loggedIn, [GROUPS_LIST]: json(GROUPS) },
    ready: visible('Lisbon trip'),
  },
  {
    route: 'home-create-sheet',
    state: 'form',
    path: '/home',
    mocks: { ...loggedIn, [GROUPS_LIST]: json(GROUPS) },
    ready: openCreateSheet,
  },
  {
    route: 'home-create-sheet',
    state: 'invite',
    path: '/home',
    mocks: {
      ...loggedIn,
      [GROUPS_LIST]: json(GROUPS),
      'POST /expense-groups': json(NEW_GROUP, 201),
      'POST /invite-link': json(
        { token: 'aGVsbG8td29ybGQtdGhpcy1pcy1hLWRlbW8tdG9rZW4' },
        201,
      ),
    },
    ready: async (page) => {
      await openCreateSheet(page);
      await page.getByLabel('Group name').fill(NEW_GROUP.name);
      await page.getByRole('button', { name: 'Create', exact: true }).click();
      await expect(page.getByText('Group created')).toBeVisible();
    },
  },
  {
    route: 'group',
    state: 'loading',
    path: GROUP_PATH,
    mocks: {
      ...groupMocks,
      [`GET /expense-groups/${String(GROUP.id)}`]: pending,
    },
    ready: loadingStatus,
  },
  {
    route: 'group',
    state: 'empty',
    path: GROUP_PATH,
    mocks: { ...groupMocks, [GROUP_FEED]: json([]) },
    ready: visible('No payments yet'),
  },
  {
    route: 'group',
    state: 'filled',
    path: GROUP_PATH,
    mocks: groupMocks,
    ready: visible('Pastéis de nata'),
  },
  {
    route: 'group',
    state: 'error',
    path: GROUP_PATH,
    mocks: { ...groupMocks, [GROUP_FEED]: status(500) },
    ready: visible("Couldn't load payments"),
  },
  {
    route: 'group',
    state: 'invite-sheet',
    path: GROUP_PATH,
    mocks: groupMocks,
    ready: async (page) => {
      await groupLoaded(page);
      await page.getByRole('button', { name: 'Group menu' }).click();
      await page.getByRole('button', { name: 'Invite people' }).click();
      await expect(page.getByLabel('Invite link')).toHaveValue(/token=/);
    },
  },
  {
    route: 'payment-amount',
    state: 'typed',
    path: `${GROUP_PATH}/payments/new/amount`,
    mocks: groupMocks,
    ready: amountTyped,
  },
  {
    route: 'payment-title',
    state: 'typed',
    path: `${GROUP_PATH}/payments/new/amount`,
    mocks: groupMocks,
    ready: toTitle,
  },
  {
    route: 'payment-options',
    state: 'equally',
    path: `${GROUP_PATH}/payments/new/amount`,
    mocks: groupMocks,
    ready: splitBy('Equally', async (page) => {
      await page.getByRole('checkbox').nth(3).uncheck();
    }),
  },
  {
    route: 'payment-options',
    state: 'shares',
    path: `${GROUP_PATH}/payments/new/amount`,
    mocks: groupMocks,
    ready: splitBy('Shares', async (page) => {
      await page.getByRole('button', { name: 'More shares for You' }).click();
      await page.getByRole('button', { name: 'Fewer shares for Max' }).click();
    }),
  },
  {
    route: 'payment-options',
    state: 'percent',
    path: `${GROUP_PATH}/payments/new/amount`,
    mocks: groupMocks,
    ready: splitBy('%', (page) =>
      fillEach(page, 'percent', ['40', '20', '20']),
    ),
  },
  {
    route: 'payment-options',
    state: 'exact',
    path: `${GROUP_PATH}/payments/new/amount`,
    mocks: groupMocks,
    ready: splitBy('Exact', (page) =>
      fillEach(page, 'amount', ['10', '6,50', '2']),
    ),
  },
  {
    route: 'payment-options',
    state: 'exact-over',
    path: `${GROUP_PATH}/payments/new/amount`,
    mocks: groupMocks,
    ready: splitBy('Exact', (page) =>
      fillEach(page, 'amount', ['10', '10', '10']),
    ),
  },
  {
    route: 'payment-details',
    state: 'loaded',
    path: DETAILS_PATH,
    mocks: groupMocks,
    ready: visible('Shares'),
  },
  {
    route: 'payment-details',
    state: 'delete-confirm',
    path: DETAILS_PATH,
    mocks: groupMocks,
    ready: async (page) => {
      await expect(page.getByText('Shares')).toBeVisible();
      await page.getByRole('button', { name: 'Delete' }).click();
      await expect(
        page.getByRole('heading', {
          name: `Delete "${DETAILED_PAYMENT.title}"?`,
        }),
      ).toBeVisible();
    },
  },
  {
    route: 'payment-edit',
    state: 'options',
    path: `${DETAILS_PATH}/edit/options`,
    mocks: groupMocks,
    ready: async (page) => {
      await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    },
  },
];

export const SIZES = [
  { width: 393, height: 852 },
  ...(process.env['ALL_SIZES'] === '1'
    ? [
        { width: 360, height: 780 },
        { width: 375, height: 667 },
      ]
    : []),
];

export const THEMES = ['light', 'dark'] as const;
