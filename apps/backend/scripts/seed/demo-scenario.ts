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
  seedUser,
} from '../../test/helpers/seed';

export type DemoSeedReport = {
  primaryUserId: number;
  realAccountCount: number;
  inviteUrl: string;
  sessionToken: string | null;
};

const SCENARIO_TABLES = [
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
  const sessionToken =
    primaryRealId === undefined && isPlainLocalhost(opts.origin)
      ? (await seedSession(client, { userId: primaryId })).token
      : null;

  const bob = await seedUser(client, { name: 'Bob' });
  const carol = await seedUser(client, { name: 'Carol' });
  const dave = await seedUser(client, { name: 'David' });

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

  const ski = await seedGroup(client, {
    name: 'Ski 2027',
    currencyCode: 'CHF',
  });
  await seedMember(client, {
    userId: primaryId,
    groupId: ski.id,
    isModerator: true,
  });

  for (const userId of otherRealIds) {
    for (const groupId of [lisbon.id, flat.id, ski.id]) {
      await seedMember(client, { userId, groupId });
    }
  }

  const invite = await seedInviteLink(client, {
    groupId: lisbon.id,
    singleUse: false,
  });

  return {
    primaryUserId: primaryId,
    realAccountCount: realIds.length,
    inviteUrl: new URL(`/join?token=${invite.token}`, opts.origin).href,
    sessionToken,
  };
}
