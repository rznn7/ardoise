import {
  computePaymentShares,
  type SplitParticipant,
  type SplitType,
} from '@ardoise/shared';
import { type Client } from 'pg';

import {
  seedGroup,
  seedInviteLink,
  seedMember,
  seedPayment,
  seedPaymentShare,
  seedSession,
  seedSettlement,
  seedUser,
} from '../../test/helpers/seed';

export type DemoSeedReport = {
  primaryUserId: number;
  realAccountCount: number;
  inviteUrl: string;
  sessionToken: string | null;
};

const SCENARIO_TABLES = [
  'settlement',
  'payment_share',
  'payment',
  'member',
  'invite_link',
  'login_state',
  'registration_state',
  'expense_group',
];

function daysAgoAt(days: number, hour: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

async function seedSplitPayment(
  client: Client,
  opts: {
    groupId: number;
    payerMemberId: number;
    title: string;
    fullAmount: number;
    splitType: SplitType;
    paidAt: Date;
    participants: readonly SplitParticipant[];
  },
): Promise<void> {
  const shares = computePaymentShares(opts);
  const { id: paymentId } = await seedPayment(client, opts);
  for (const share of shares) {
    await seedPaymentShare(client, { paymentId, ...share });
  }
}

async function seedFlatshareHistory(
  client: Client,
  {
    groupId,
    carol,
    primary,
  }: { groupId: number; carol: number; primary: number },
): Promise<void> {
  const chores = ['Groceries', 'Cleaning supplies', 'Toilet paper', 'Bin bags'];
  const payments = Array.from({ length: 128 }, (_, i) => ({
    payerMemberId: i % 2 === 0 ? carol : primary,
    title: chores[Math.floor(i / 2) % chores.length] ?? 'Groceries',
    fullAmount: 1000 + 100 * Math.floor(i / 2),
    paidAt: daysAgoAt(10 + 2 * i, 12),
  }));
  const { rows } = await client.query<{ id: number }>(
    `INSERT INTO payment (group_id, payer_member_id, title, full_amount, split_type, paid_at)
     SELECT $1, payer, title, amount, 'equal', paid_at
     FROM unnest($2::int[], $3::text[], $4::int[], $5::timestamptz[]) WITH ORDINALITY
       AS p(payer, title, amount, paid_at, n)
     ORDER BY n
     RETURNING id`,
    [
      groupId,
      payments.map((p) => p.payerMemberId),
      payments.map((p) => p.title),
      payments.map((p) => p.fullAmount),
      payments.map((p) => p.paidAt),
    ],
  );
  const shares = payments.flatMap((payment, i) =>
    computePaymentShares({
      fullAmount: payment.fullAmount,
      payerMemberId: payment.payerMemberId,
      splitType: 'equal',
      participants: equally([carol, primary]),
    }).map((share) => ({ ...share, paymentId: rows[i]?.id ?? 0 })),
  );
  await client.query(
    `INSERT INTO payment_share (payment_id, member_id, input_value, amount)
     SELECT * FROM unnest($1::int[], $2::int[], $3::int[], $4::int[])`,
    [
      shares.map((s) => s.paymentId),
      shares.map((s) => s.memberId),
      shares.map((s) => s.inputValue),
      shares.map((s) => s.amount),
    ],
  );

  const settlements = Array.from({ length: 60 }, (_, i) => ({
    from: i % 2 === 0 ? primary : carol,
    to: i % 2 === 0 ? carol : primary,
    amount: 500 + 50 * Math.floor(i / 2),
    settledAt: daysAgoAt(11 + 4 * i, 18),
  }));
  await client.query(
    `INSERT INTO settlement (group_id, from_member_id, to_member_id, created_by_member_id, amount, settled_at)
     SELECT $1, f, t, f, a, d FROM unnest($2::int[], $3::int[], $4::int[], $5::timestamptz[]) AS s(f, t, a, d)`,
    [
      groupId,
      settlements.map((s) => s.from),
      settlements.map((s) => s.to),
      settlements.map((s) => s.amount),
      settlements.map((s) => s.settledAt),
    ],
  );
}

const equally = (memberIds: readonly number[]): SplitParticipant[] =>
  memberIds.map((memberId) => ({ memberId, inputValue: 0 }));

const isPlainLocalhost = (origin: string): boolean => {
  const url = new URL(origin);
  return url.protocol === 'http:' && url.hostname === 'localhost';
};

async function wipeAllButRealAccounts(client: Client): Promise<number[]> {
  await client.query(
    `TRUNCATE ${SCENARIO_TABLES.join(', ')} RESTART IDENTITY CASCADE`,
  );
  await client.query(
    `DELETE FROM users u WHERE NOT EXISTS (SELECT 1 FROM passkey p WHERE p.user_id = u.id)`,
  );
  const { rows } = await client.query<{ id: number }>(
    `SELECT id FROM users ORDER BY id`,
  );
  return rows.map((row) => row.id);
}

export async function seedDemo(
  client: Client,
  opts: { origin: string },
): Promise<DemoSeedReport> {
  const realIds = await wipeAllButRealAccounts(client);
  const [primaryRealId, ...otherRealIds] = realIds;

  const primaryId =
    primaryRealId ?? (await seedUser(client, { name: 'Alice' })).id;
  await client.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [
    primaryId,
  ]);
  const sessionToken =
    primaryRealId === undefined && isPlainLocalhost(opts.origin)
      ? (await seedSession(client, { userId: primaryId })).token
      : null;

  const bob = await seedUser(client, { name: 'Bob' });
  const carol = await seedUser(client, { name: 'Carol' });
  const dave = await seedUser(client, { name: 'David' });
  await seedUser(client, { name: 'Emma' });

  const lisbon = await seedGroup(client, {
    name: 'Trip to Lisbon',
    currencyCode: 'EUR',
  });
  const mPrimary = await seedMember(client, {
    userId: primaryId,
    groupId: lisbon.id,
    isModerator: true,
  });
  const mBob = await seedMember(client, {
    userId: bob.id,
    groupId: lisbon.id,
  });
  const mCarol = await seedMember(client, {
    userId: carol.id,
    groupId: lisbon.id,
  });
  const mDave = await seedMember(client, {
    userId: dave.id,
    groupId: lisbon.id,
    nickname: 'Dédé',
  });
  const everyone = [mPrimary.id, mBob.id, mCarol.id, mDave.id];

  await seedSplitPayment(client, {
    groupId: lisbon.id,
    payerMemberId: mPrimary.id,
    title: 'Pizza',
    fullAmount: 2450,
    splitType: 'equal',
    paidAt: daysAgoAt(0, 1),
    participants: equally([mPrimary.id, mBob.id, mCarol.id]),
  });
  await seedSplitPayment(client, {
    groupId: lisbon.id,
    payerMemberId: mBob.id,
    title: 'Groceries at Pingo Doce',
    fullAmount: 6385,
    splitType: 'shares',
    paidAt: daysAgoAt(1, 18),
    participants: [
      { memberId: mPrimary.id, inputValue: 1 },
      { memberId: mBob.id, inputValue: 2 },
      { memberId: mCarol.id, inputValue: 1 },
      { memberId: mDave.id, inputValue: 1 },
    ],
  });
  await seedSplitPayment(client, {
    groupId: lisbon.id,
    payerMemberId: mDave.id,
    title: 'Fado night',
    fullAmount: 9000,
    splitType: 'exact',
    paidAt: daysAgoAt(1, 22),
    participants: [
      { memberId: mPrimary.id, inputValue: 2500 },
      { memberId: mBob.id, inputValue: 2500 },
      { memberId: mCarol.id, inputValue: 2000 },
      { memberId: mDave.id, inputValue: 2000 },
    ],
  });
  await seedSplitPayment(client, {
    groupId: lisbon.id,
    payerMemberId: mPrimary.id,
    title: 'Airbnb, 4 nights in Alfama',
    fullAmount: 48000,
    splitType: 'percent',
    paidAt: daysAgoAt(3, 12),
    participants: [
      { memberId: mPrimary.id, inputValue: 3000 },
      { memberId: mBob.id, inputValue: 3000 },
      { memberId: mCarol.id, inputValue: 2000 },
      { memberId: mDave.id, inputValue: 2000 },
    ],
  });
  await seedSplitPayment(client, {
    groupId: lisbon.id,
    payerMemberId: mCarol.id,
    title: 'Pastéis de nata',
    fullAmount: 750,
    splitType: 'equal',
    paidAt: daysAgoAt(4, 10),
    participants: equally(everyone),
  });

  await seedSettlement(client, {
    groupId: lisbon.id,
    fromMemberId: mCarol.id,
    toMemberId: mBob.id,
    amount: 1500,
    settledAt: daysAgoAt(2, 19),
  });

  const flat = await seedGroup(client, {
    name: 'Flatshare',
    currencyCode: 'EUR',
  });
  const fCarol = await seedMember(client, {
    userId: carol.id,
    groupId: flat.id,
    isModerator: true,
  });
  const fPrimary = await seedMember(client, {
    userId: primaryId,
    groupId: flat.id,
  });
  const flatmates = [fCarol.id, fPrimary.id];

  await seedSplitPayment(client, {
    groupId: flat.id,
    payerMemberId: fCarol.id,
    title: 'Electricity',
    fullAmount: 8640,
    splitType: 'equal',
    paidAt: daysAgoAt(2, 12),
    participants: equally(flatmates),
  });
  await seedSplitPayment(client, {
    groupId: flat.id,
    payerMemberId: fPrimary.id,
    title: 'Internet',
    fullAmount: 2999,
    splitType: 'equal',
    paidAt: daysAgoAt(9, 12),
    participants: equally(flatmates),
  });

  await seedSettlement(client, {
    groupId: flat.id,
    fromMemberId: fPrimary.id,
    toMemberId: fCarol.id,
    amount: 1000,
    settledAt: daysAgoAt(1, 18),
  });

  await seedFlatshareHistory(client, {
    groupId: flat.id,
    carol: fCarol.id,
    primary: fPrimary.id,
  });

  const ski = await seedGroup(client, {
    name: 'Ski 2027',
    currencyCode: 'CHF',
  });
  await seedMember(client, {
    userId: primaryId,
    groupId: ski.id,
    isModerator: true,
  });

  const dinners = await seedGroup(client, {
    name: 'Friday dinners',
    currencyCode: 'EUR',
  });
  const dPrimary = await seedMember(client, {
    userId: primaryId,
    groupId: dinners.id,
    isModerator: true,
  });
  const dBob = await seedMember(client, {
    userId: bob.id,
    groupId: dinners.id,
  });
  const diners = [dPrimary.id, dBob.id];

  await seedSplitPayment(client, {
    groupId: dinners.id,
    payerMemberId: dPrimary.id,
    title: 'Ramen',
    fullAmount: 4000,
    splitType: 'equal',
    paidAt: daysAgoAt(7, 20),
    participants: equally(diners),
  });
  await seedSplitPayment(client, {
    groupId: dinners.id,
    payerMemberId: dBob.id,
    title: 'Tapas',
    fullAmount: 2000,
    splitType: 'equal',
    paidAt: daysAgoAt(14, 20),
    participants: equally(diners),
  });
  await seedSettlement(client, {
    groupId: dinners.id,
    fromMemberId: dBob.id,
    toMemberId: dPrimary.id,
    amount: 1000,
    settledAt: daysAgoAt(5, 21),
  });

  for (const userId of otherRealIds) {
    for (const groupId of [lisbon.id, flat.id, ski.id, dinners.id]) {
      await seedMember(client, { userId, groupId });
    }
  }

  const invite = await seedInviteLink(client, {
    groupId: lisbon.id,
    singleUse: false,
  });
  await seedInviteLink(client, {
    groupId: lisbon.id,
    burnedByUserId: carol.id,
  });
  await seedInviteLink(client, {
    groupId: lisbon.id,
    singleUse: false,
    expiresInDays: -3,
  });
  await seedInviteLink(client, {
    groupId: lisbon.id,
    revoked: true,
  });

  return {
    primaryUserId: primaryId,
    realAccountCount: realIds.length,
    inviteUrl: new URL(`/join?token=${invite.token}`, opts.origin).href,
    sessionToken,
  };
}
