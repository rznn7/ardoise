import { expect, type Page } from '@playwright/test';

import {
  abort,
  ADMIN_GROUP,
  ADMIN_LONER,
  ADMIN_ME,
  ADMIN_OVERVIEW,
  ADMIN_SELF,
  ADMIN_USER,
  type ApiMocks,
  balancesWhereIAmAt,
  FEED,
  feedOf,
  GROUP,
  GROUP_BALANCES,
  GROUPS,
  json,
  ME,
  MEMBERS,
  MY_BALANCES,
  NEW_GROUP,
  pageOf,
  PAYMENTS,
  pending,
  SETTLEMENTS,
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
const adminMocks: ApiMocks = {
  'POST /auth/me': json(ADMIN_ME),
  'GET /admin/overview': json(ADMIN_OVERVIEW),
  'GET /admin/users/2': json(ADMIN_USER),
  'GET /admin/users/1': json(ADMIN_SELF),
  'GET /admin/users/6': json(ADMIN_LONER),
  'GET /admin/groups/1': json(ADMIN_GROUP),
};
const loggedOut: ApiMocks = { 'POST /auth/me': status(401) };
const PREVIEW = 'GET /invite-link/[^/]+/preview';
const GROUPS_LIST = 'GET /expense-groups';
const GROUP_PATH = `/group/${String(GROUP.id)}`;
const GROUP_FEED = `GET /expense-groups/${String(GROUP.id)}/feed`;
const NEXT_FEED_PAGE = `${GROUP_FEED}\\?cursor=.*`;
const GROUP_DONE = `GET /expense-groups/${String(GROUP.id)}/settlements`;
const NEXT_DONE_PAGE = `${GROUP_DONE}\\?cursor=.*`;
const GROUP_BALANCES_PATH = `GET /expense-groups/${String(GROUP.id)}/balances`;
const MY_BALANCES_PATH = 'GET /balances/mine';
const BALANCES_TAB = `${GROUP_PATH}?tab=balances`;
const INVITE_TOKEN = 'aGVsbG8td29ybGQtdGhpcy1pcy1hLWRlbW8tdG9rZW4';
const [DETAILED_PAYMENT] = PAYMENTS;
if (DETAILED_PAYMENT === undefined) throw new Error('PAYMENTS is empty');
const DETAILS_PATH = `${GROUP_PATH}/payments/${String(DETAILED_PAYMENT.id)}`;
const [MY_REPAYMENT, OTHERS_REPAYMENT] = SETTLEMENTS;
if (MY_REPAYMENT === undefined || OTHERS_REPAYMENT === undefined)
  throw new Error('SETTLEMENTS needs two entries');
const repaymentPath = (id: number) => `${GROUP_PATH}/settlements/${String(id)}`;
const findRepayment = (id: number) => `GET /settlements/${String(id)}`;

const groupMocks: ApiMocks = {
  ...loggedIn,
  [`GET /expense-groups/${String(GROUP.id)}`]: json(GROUP),
  [`GET /expense-groups/${String(GROUP.id)}/members`]: json(MEMBERS),
  [GROUP_FEED]: json(pageOf(FEED)),
  [GROUP_DONE]: json(pageOf(SETTLEMENTS)),
  [findRepayment(MY_REPAYMENT.id)]: json(MY_REPAYMENT),
  [findRepayment(OTHERS_REPAYMENT.id)]: json(OTHERS_REPAYMENT),
  [GROUP_BALANCES_PATH]: json(GROUP_BALANCES),
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

const scrollToBottom = async (page: Page): Promise<void> => {
  await page.locator('main').evaluate((main) => {
    main.scrollTo(0, main.scrollHeight);
  });
};

const pullDown = async (page: Page): Promise<void> => {
  const box = await page.locator('main').boundingBox();
  if (!box) throw new Error('no main');
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(x, box.y + 300, { steps: 12 });
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
    mocks: {
      ...loggedIn,
      [GROUPS_LIST]: json(GROUPS),
      [MY_BALANCES_PATH]: json(MY_BALANCES),
    },
    ready: visible('−€42.50'),
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
    mocks: { ...groupMocks, [GROUP_FEED]: json(pageOf([])) },
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
    route: 'group',
    state: 'owe',
    path: GROUP_PATH,
    mocks: {
      ...groupMocks,
      [GROUP_BALANCES_PATH]: json(balancesWhereIAmAt(-4250)),
    },
    ready: visible('You owe'),
  },
  {
    route: 'group',
    state: 'owed',
    path: GROUP_PATH,
    mocks: {
      ...groupMocks,
      [GROUP_BALANCES_PATH]: json(balancesWhereIAmAt(1830)),
    },
    ready: visible('Owed to you'),
  },
  {
    route: 'group',
    state: 'settled-up',
    path: GROUP_PATH,
    mocks: {
      ...groupMocks,
      [GROUP_BALANCES_PATH]: json(balancesWhereIAmAt(0)),
    },
    ready: visible('Settled up'),
  },
  {
    route: 'group',
    state: 'balance-loading',
    path: GROUP_PATH,
    mocks: { ...groupMocks, [GROUP_BALANCES_PATH]: pending },
    ready: visible('Pastéis de nata'),
  },
  {
    route: 'group-balances',
    state: 'filled',
    path: BALANCES_TAB,
    mocks: groupMocks,
    ready: visible('You pay Max'),
  },
  {
    route: 'group-balances',
    state: 'all-settled',
    path: BALANCES_TAB,
    mocks: {
      ...groupMocks,
      [GROUP_BALANCES_PATH]: json(balancesWhereIAmAt(0)),
    },
    ready: visible('All settled'),
  },
  {
    route: 'group-balances',
    state: 'no-payments',
    path: BALANCES_TAB,
    mocks: {
      ...groupMocks,
      [GROUP_FEED]: json(pageOf([])),
      [GROUP_BALANCES_PATH]: json(balancesWhereIAmAt(0)),
    },
    ready: visible('Nothing to settle yet'),
  },
  {
    route: 'group-balances',
    state: 'loading',
    path: BALANCES_TAB,
    mocks: { ...groupMocks, [GROUP_BALANCES_PATH]: pending },
    ready: loadingStatus,
  },
  {
    route: 'group-balances',
    state: 'error',
    path: BALANCES_TAB,
    mocks: { ...groupMocks, [GROUP_BALANCES_PATH]: status(500) },
    ready: visible("Couldn't load balances"),
  },
  {
    route: 'home',
    state: 'admin',
    path: '/home',
    mocks: {
      ...adminMocks,
      [GROUPS_LIST]: json(GROUPS),
      [MY_BALANCES_PATH]: json(MY_BALANCES),
    },
    ready: async (page) => {
      await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();
    },
  },
  {
    route: 'admin',
    state: 'users',
    path: '/admin',
    mocks: adminMocks,
    ready: visible('Gabriel'),
  },
  {
    route: 'admin',
    state: 'groups',
    path: '/admin?tab=groups',
    mocks: adminMocks,
    ready: visible('Ski 2027'),
  },
  {
    route: 'admin',
    state: 'loading',
    path: '/admin',
    mocks: { ...adminMocks, 'GET /admin/overview': pending },
    ready: loadingStatus,
  },
  {
    route: 'admin',
    state: 'error',
    path: '/admin',
    mocks: { ...adminMocks, 'GET /admin/overview': status(500) },
    ready: visible("Couldn't load the overview"),
  },
  {
    route: 'admin-user',
    state: 'groups',
    path: '/admin/users/2',
    mocks: adminMocks,
    ready: visible('Sessions'),
  },
  {
    route: 'admin-user',
    state: 'this-device',
    path: '/admin/users/1',
    mocks: adminMocks,
    ready: visible('This device'),
  },
  {
    route: 'admin-user',
    state: 'no-group',
    path: '/admin/users/6',
    mocks: adminMocks,
    ready: visible('No active session'),
  },
  {
    route: 'admin-user',
    state: 'revoke-sheet',
    path: '/admin/users/2',
    mocks: adminMocks,
    ready: async (page) => {
      await page.getByRole('button', { name: 'Revoke' }).first().click();
      await expect(page.getByText('Sign this session out?')).toBeVisible();
    },
  },
  {
    route: 'admin-user',
    state: 'not-found',
    path: '/admin/users/99',
    mocks: { ...adminMocks, 'GET /admin/users/99': status(404) },
    ready: visible('This user no longer exists'),
  },
  {
    route: 'admin-group',
    state: 'links',
    path: '/admin/groups/1',
    mocks: adminMocks,
    ready: visible('Invite links'),
  },
  {
    route: 'admin-group',
    state: 'revoke-sheet',
    path: '/admin/groups/1',
    mocks: adminMocks,
    ready: async (page) => {
      await page.getByRole('button', { name: 'Revoke' }).click();
      await expect(page.getByText('Revoke this link?')).toBeVisible();
    },
  },
  {
    route: 'group-balances',
    state: 'confirm-i-pay',
    path: BALANCES_TAB,
    mocks: groupMocks,
    ready: async (page) => {
      await page.getByRole('button', { name: /You pay Max/ }).click();
      await expect(
        page.getByRole('button', { name: 'I paid Max back' }),
      ).toBeVisible();
    },
  },
  {
    route: 'group-balances',
    state: 'confirm-paid-me',
    path: BALANCES_TAB,
    mocks: {
      ...groupMocks,
      [GROUP_BALANCES_PATH]: json(balancesWhereIAmAt(1830)),
    },
    ready: async (page) => {
      await page.getByRole('button', { name: /Léa pays you/ }).click();
      await expect(
        page.getByRole('button', { name: 'Léa paid me back' }),
      ).toBeVisible();
    },
  },
  {
    route: 'group-balances',
    state: 'repayment-saving',
    path: BALANCES_TAB,
    mocks: { ...groupMocks, 'POST /settlements': pending },
    ready: async (page) => {
      await page.getByRole('button', { name: /You pay Max/ }).click();
      await page.getByRole('button', { name: 'I paid Max back' }).click();
      await expect(page.getByText('Saving…')).toBeVisible();
    },
  },
  {
    route: 'group-balances',
    state: 'undo-sheet',
    path: BALANCES_TAB,
    mocks: groupMocks,
    ready: async (page) => {
      await page.getByRole('button', { name: /You paid Léa back/ }).click();
      await expect(
        page.getByRole('button', { name: 'Undo repayment' }),
      ).toBeVisible();
    },
  },
  {
    route: 'group',
    state: 'repayment-saving',
    path: BALANCES_TAB,
    mocks: { ...groupMocks, 'POST /settlements': pending },
    ready: async (page) => {
      await page.getByRole('button', { name: /You pay Max/ }).click();
      await page.getByRole('button', { name: 'I paid Max back' }).click();
      await page.getByRole('button', { name: 'Payments' }).click();
      await expect(page.getByText('Saving…')).toBeVisible();
    },
  },
  {
    route: 'group',
    state: 'loading-more',
    path: GROUP_PATH,
    mocks: {
      ...groupMocks,
      [GROUP_FEED]: json(pageOf(FEED, 'next')),
      [NEXT_FEED_PAGE]: pending,
    },
    ready: async (page) => {
      await groupLoaded(page);
      await scrollToBottom(page);
      await expect(
        page.getByRole('status', { name: 'Loading more' }),
      ).toBeVisible();
    },
  },
  {
    route: 'group',
    state: 'load-more-error',
    path: GROUP_PATH,
    mocks: {
      ...groupMocks,
      [GROUP_FEED]: json(pageOf(FEED, 'next')),
      [NEXT_FEED_PAGE]: status(500),
    },
    ready: async (page) => {
      await groupLoaded(page);
      await scrollToBottom(page);
      await expect(page.getByText("Couldn't load more")).toBeVisible();
    },
  },
  {
    route: 'group',
    state: 'done-loading-more',
    path: BALANCES_TAB,
    mocks: {
      ...groupMocks,
      [GROUP_DONE]: json(pageOf(SETTLEMENTS, 'next')),
      [NEXT_DONE_PAGE]: pending,
    },
    ready: async (page) => {
      await expect(page.getByText('Done')).toBeVisible();
      await scrollToBottom(page);
      await expect(
        page.getByRole('status', { name: 'Loading more' }),
      ).toBeVisible();
    },
  },
  {
    route: 'group',
    state: 'pulling',
    path: GROUP_PATH,
    mocks: groupMocks,
    ready: async (page) => {
      await groupLoaded(page);
      await pullDown(page);
      await expect(
        page.getByRole('status', { name: 'Pull to refresh' }),
      ).toBeVisible();
    },
  },
  {
    route: 'group',
    state: 'refreshing',
    path: GROUP_PATH,
    mocks: groupMocks,
    ready: async (page) => {
      await groupLoaded(page);
      await page.route('**/api/expense-groups/*/feed', () => undefined);
      await pullDown(page);
      await page.mouse.up();
      await expect(
        page.getByRole('status', { name: 'Refreshing' }),
      ).toBeVisible();
    },
  },
  {
    route: 'group',
    state: 'only-repayments',
    path: GROUP_PATH,
    mocks: {
      ...groupMocks,
      [GROUP_FEED]: json(pageOf(feedOf([], SETTLEMENTS))),
    },
    ready: visible('Tom paid Léa back'),
  },
  {
    route: 'settlement-details',
    state: 'involved',
    path: repaymentPath(MY_REPAYMENT.id),
    mocks: groupMocks,
    ready: visible('Undo repayment'),
  },
  {
    route: 'settlement-details',
    state: 'not-involved',
    path: repaymentPath(OTHERS_REPAYMENT.id),
    mocks: groupMocks,
    ready: visible('Tom paid Léa back'),
  },
  {
    route: 'settlement-details',
    state: 'loading',
    path: repaymentPath(MY_REPAYMENT.id),
    mocks: { ...groupMocks, [findRepayment(MY_REPAYMENT.id)]: pending },
    ready: loadingStatus,
  },
  {
    route: 'settlement-details',
    state: 'not-found',
    path: repaymentPath(MY_REPAYMENT.id),
    mocks: { ...groupMocks, [findRepayment(MY_REPAYMENT.id)]: status(404) },
    ready: visible('This repayment was undone'),
  },
  {
    route: 'settlement-details',
    state: 'undo-confirm',
    path: repaymentPath(MY_REPAYMENT.id),
    mocks: groupMocks,
    ready: async (page) => {
      await page.getByRole('button', { name: 'Undo repayment' }).click();
      await expect(page.getByText('Undo this repayment?')).toBeVisible();
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
    route: 'payment-details',
    state: 'deleted-by-someone-else',
    path: DETAILS_PATH,
    mocks: groupMocks,
    ready: async (page) => {
      await expect(page.getByText('Shares')).toBeVisible();
      const messages = [
        { type: 'ready' },
        {
          type: 'payment.deleted',
          groupId: GROUP.id,
          opId: null,
          id: DETAILED_PAYMENT.id,
        },
      ];
      await page.route('**/api/events', (route) =>
        route.fulfill({
          contentType: 'text/event-stream',
          body: messages
            .map((message) => `data: ${JSON.stringify(message)}\n\n`)
            .join(''),
        }),
      );
      await expect(page.getByText('This payment was deleted')).toBeVisible();
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
