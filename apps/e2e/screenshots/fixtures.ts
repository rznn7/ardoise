import {
  type AdminGroup,
  type AdminOverview,
  type AdminUser,
  computePaymentShares,
  type ExpenseGroupSummary,
  type FeedItem,
  type GroupBalancesResponse,
  type GroupMember,
  type MyBalance,
  type MeResponse,
  type PaymentResponse,
  type PaymentShareResponse,
  type SettlementResponse,
} from '@ardoise/shared';
import { type Page, type Route } from '@playwright/test';

export const ME: MeResponse = { id: 1, name: 'Gabriel', role: 'user' };

export const GROUP: ExpenseGroupSummary = {
  id: 1,
  name: 'Lisbon trip',
  currencyCode: 'EUR',
  createdAt: '2026-10-01T10:00:00.000Z',
};

export const GROUPS: ExpenseGroupSummary[] = [
  GROUP,
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

export const MEMBERS: GroupMember[] = [
  { id: 11, userId: 1, name: 'Gabriel', nickname: null, isModerator: true },
  { id: 12, userId: 2, name: 'Léa', nickname: null, isModerator: false },
  { id: 13, userId: 3, name: 'Tom', nickname: null, isModerator: false },
  { id: 14, userId: 4, name: 'Max', nickname: null, isModerator: false },
  { id: 15, userId: 5, name: 'Inès', nickname: null, isModerator: false },
];

const daysAgoAt = (days: number, hour: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

const payment = (
  id: number,
  title: string,
  fullAmount: number,
  payerMemberId: number,
  paidAt: string,
  splitType: PaymentResponse['splitType'] = 'equal',
): PaymentResponse => ({
  id,
  payerMemberId,
  groupId: GROUP.id,
  title,
  paidAt,
  fullAmount,
  splitType,
  createdAt: paidAt,
});

export const PAYMENTS: PaymentResponse[] = [
  payment(101, 'Pizza', 2450, 11, daysAgoAt(0, 20)),
  payment(102, 'Tram tickets', 1200, 12, daysAgoAt(0, 9)),
  payment(104, 'Fado night', 9000, 14, daysAgoAt(1, 22), 'exact'),
  payment(103, 'Groceries at Pingo Doce', 6385, 13, daysAgoAt(1, 18), 'shares'),
  payment(
    105,
    'Airbnb, 4 nights in Alfama',
    48000,
    11,
    daysAgoAt(3, 12),
    'percent',
  ),
  payment(106, 'Pastéis de nata', 750, 15, daysAgoAt(4, 10)),
];

const settlement = (
  id: number,
  fromMemberId: number,
  toMemberId: number,
  amount: number,
  settledAt: string,
): SettlementResponse => ({
  id,
  groupId: GROUP.id,
  fromMemberId,
  toMemberId,
  amount,
  settledAt,
  createdByMemberId: fromMemberId,
  createdAt: settledAt,
});

export const SETTLEMENTS: SettlementResponse[] = [
  settlement(201, 11, 12, 2000, daysAgoAt(0, 12)),
  settlement(202, 13, 12, 1500, daysAgoAt(2, 19)),
];

export const feedOf = (
  payments: readonly PaymentResponse[],
  settlements: readonly SettlementResponse[],
): FeedItem[] => [
  ...payments.map((payment): FeedItem => ({ kind: 'payment', payment })),
  ...settlements.map((settlement): FeedItem => ({
    kind: 'settlement',
    settlement,
  })),
];

export const FEED = feedOf(PAYMENTS, SETTLEMENTS);

export const GROUP_BALANCES: GroupBalancesResponse = {
  balances: [
    { memberId: 11, amount: -4250 },
    { memberId: 12, amount: 8820 },
    { memberId: 13, amount: -2110 },
    { memberId: 14, amount: 3360 },
    { memberId: 15, amount: -5820 },
  ],
  transfers: [
    { fromMemberId: 15, toMemberId: 12, amount: 5820 },
    { fromMemberId: 11, toMemberId: 14, amount: 3360 },
    { fromMemberId: 13, toMemberId: 12, amount: 2110 },
    { fromMemberId: 11, toMemberId: 12, amount: 890 },
  ],
};

export const balancesWhereIAmAt = (amount: number): GroupBalancesResponse => ({
  balances: MEMBERS.map((member, index) => ({
    memberId: member.id,
    amount: index === 0 ? amount : index === 1 ? -amount : 0,
  })),
  transfers:
    amount === 0
      ? []
      : amount > 0
        ? [{ fromMemberId: 12, toMemberId: 11, amount }]
        : [{ fromMemberId: 11, toMemberId: 12, amount: -amount }],
});

export const MY_BALANCES: MyBalance[] = [
  { groupId: 1, amount: -4250 },
  { groupId: 2, amount: 1830 },
  { groupId: 3, amount: 0 },
  { groupId: 4, amount: 0 },
];

export const SHARES: PaymentShareResponse[] = computePaymentShares({
  fullAmount: 2450,
  splitType: 'equal',
  payerMemberId: 11,
  participants: [11, 12, 13, 15].map((memberId) => ({
    memberId,
    inputValue: 0,
  })),
}).map((share) => ({ paymentId: 101, ...share }));

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

export const ADMIN_ME: MeResponse = { ...ME, role: 'admin' };

const daysFromNow = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
};

export const ADMIN_OVERVIEW: AdminOverview = {
  counts: { users: 6, groups: 4, payments: 84 },
  users: [
    {
      id: 6,
      name: 'Emma',
      role: 'user',
      createdAt: daysFromNow(-1),
      lastSignInAt: null,
      groupCount: 0,
    },
    {
      id: 1,
      name: 'Gabriel',
      role: 'admin',
      createdAt: daysFromNow(-40),
      lastSignInAt: daysFromNow(0),
      groupCount: 4,
    },
    {
      id: 5,
      name: 'Inès',
      role: 'user',
      createdAt: daysFromNow(-30),
      lastSignInAt: daysFromNow(-20),
      groupCount: 1,
    },
    {
      id: 2,
      name: 'Léa',
      role: 'user',
      createdAt: daysFromNow(-38),
      lastSignInAt: daysFromNow(-2),
      groupCount: 3,
    },
    {
      id: 4,
      name: 'Max',
      role: 'user',
      createdAt: daysFromNow(-35),
      lastSignInAt: daysFromNow(-9),
      groupCount: 1,
    },
    {
      id: 3,
      name: 'Tom',
      role: 'user',
      createdAt: daysFromNow(-36),
      lastSignInAt: daysFromNow(-1),
      groupCount: 2,
    },
  ],
  groups: [
    {
      id: 2,
      name: 'Flatshare Rue Oberkampf, 3rd floor, left',
      currencyCode: 'EUR',
      createdAt: daysFromNow(-45),
      memberCount: 2,
      paymentCount: 14,
    },
    {
      id: 4,
      name: 'Friday dinners',
      currencyCode: 'EUR',
      createdAt: daysFromNow(-100),
      memberCount: 2,
      paymentCount: 2,
    },
    {
      id: 1,
      name: 'Lisbon trip',
      currencyCode: 'EUR',
      createdAt: daysFromNow(-26),
      memberCount: 5,
      paymentCount: 68,
    },
    {
      id: 3,
      name: 'Ski 2027',
      currencyCode: 'CHF',
      createdAt: daysFromNow(-60),
      memberCount: 1,
      paymentCount: 0,
    },
  ],
};

export const ADMIN_USER: AdminUser = {
  user: {
    id: 2,
    name: 'Léa',
    role: 'user',
    createdAt: daysFromNow(-38),
    lastSignInAt: daysFromNow(-2),
    passkeyCount: 1,
  },
  groups: [
    {
      groupId: 2,
      name: 'Flatshare Rue Oberkampf, 3rd floor, left',
      currencyCode: 'EUR',
      isModerator: true,
      memberCount: 2,
      balance: -1830,
    },
    {
      groupId: 4,
      name: 'Friday dinners',
      currencyCode: 'EUR',
      isModerator: false,
      memberCount: 2,
      balance: 0,
    },
    {
      groupId: 1,
      name: 'Lisbon trip',
      currencyCode: 'EUR',
      isModerator: false,
      memberCount: 5,
      balance: 8820,
    },
  ],
  sessions: [
    {
      id: 41,
      issuedAt: daysFromNow(-2),
      expiresAt: daysFromNow(5),
      current: false,
    },
    {
      id: 37,
      issuedAt: daysFromNow(-6),
      expiresAt: daysFromNow(1),
      current: false,
    },
  ],
};

export const ADMIN_SELF: AdminUser = {
  user: {
    id: 1,
    name: 'Gabriel',
    role: 'admin',
    createdAt: daysFromNow(-40),
    lastSignInAt: daysFromNow(0),
    passkeyCount: 1,
  },
  groups: [
    {
      groupId: 1,
      name: 'Lisbon trip',
      currencyCode: 'EUR',
      isModerator: true,
      memberCount: 5,
      balance: -4250,
    },
  ],
  sessions: [
    {
      id: 50,
      issuedAt: daysFromNow(0),
      expiresAt: daysFromNow(7),
      current: true,
    },
  ],
};

export const ADMIN_LONER: AdminUser = {
  user: {
    id: 6,
    name: 'Emma',
    role: 'user',
    createdAt: daysFromNow(-1),
    lastSignInAt: null,
    passkeyCount: 1,
  },
  groups: [],
  sessions: [],
};

export const ADMIN_GROUP: AdminGroup = {
  group: {
    id: 1,
    name: 'Lisbon trip',
    currencyCode: 'EUR',
    createdAt: daysFromNow(-26),
    paymentCount: 68,
    totalSpent: 124000,
  },
  members: MEMBERS.map((member, index) => ({
    memberId: member.id,
    userId: member.userId,
    name: member.name,
    isModerator: member.isModerator,
    balance: [-4250, 8820, -2110, 3360, -5820][index] ?? 0,
  })),
  inviteLinks: [
    {
      id: 4,
      singleUse: false,
      status: 'active',
      expiresAt: daysFromNow(5),
      burnedAt: null,
      burnedByName: null,
      revokedAt: null,
      createdAt: daysFromNow(-2),
    },
    {
      id: 3,
      singleUse: true,
      status: 'used',
      expiresAt: daysFromNow(2),
      burnedAt: daysFromNow(-5),
      burnedByName: 'Tom',
      revokedAt: null,
      createdAt: daysFromNow(-6),
    },
    {
      id: 2,
      singleUse: false,
      status: 'expired',
      expiresAt: daysFromNow(-3),
      burnedAt: null,
      burnedByName: null,
      revokedAt: null,
      createdAt: daysFromNow(-10),
    },
    {
      id: 1,
      singleUse: true,
      status: 'revoked',
      expiresAt: daysFromNow(3),
      burnedAt: null,
      burnedByName: null,
      revokedAt: daysFromNow(-1),
      createdAt: daysFromNow(-4),
    },
  ],
};
