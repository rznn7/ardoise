import { expect, type Page } from '@playwright/test';

import {
  abort,
  type ApiMocks,
  GROUPS,
  json,
  ME,
  NEW_GROUP,
  pending,
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

const visible = (text: string | RegExp) => async (page: Page) => {
  await expect(page.getByText(text).first()).toBeVisible();
};

const loadingStatus = async (page: Page): Promise<void> => {
  await expect(
    page.getByRole('status', { name: 'Loading' }).first(),
  ).toBeVisible();
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
