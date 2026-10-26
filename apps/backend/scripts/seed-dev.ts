import 'dotenv/config';

import {
  computePaymentShares,
  type SplitParticipant,
  type SplitType,
} from '@ardoise/shared';
import { Client } from 'pg';

import {
  seedGroup,
  seedInviteLink,
  seedMember,
  seedPasskey,
  seedPayment,
  seedPaymentShare,
  seedSession,
  seedUser,
} from '../test/helpers/seed';

/**
 * Seeds the local dev database with a realistic scenario so you can click
 * around the app. Idempotent: wipes all app data first, then reseeds.
 *
 * Run with: pnpm --filter @ardoise/backend db:seed
 *
 * Auth is passkey-based and can't be seeded (passkeys need a real
 * authenticator), so instead we mint a session for the primary user and print
 * its token. Paste it as the `session_token` cookie in your browser to be
 * logged in as that user (see instructions printed at the end).
 */

const TABLES = [
  'payment_share',
  'payment',
  'member',
  'invite_link',
  'session',
  'passkey',
  'login_state',
  'registration_state',
  'expense_group',
  'users',
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

async function main() {
  const client = new Client({ connectionString: process.env['DATABASE_URL'] });
  await client.connect();

  try {
    await client.query(
      `TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`,
    );

    const alice = await seedUser(client, { name: 'Alice' });
    await seedPasskey(client, { userId: alice.id, credentialId: 'dev-alice' });
    const { token: sessionToken } = await seedSession(client, {
      userId: alice.id,
    });

    const bob = await seedUser(client, { name: 'Bob' });
    const carol = await seedUser(client, { name: 'Carol' });
    const dave = await seedUser(client, { name: 'David' });

    const lisbon = await seedGroup(client, {
      name: 'Trip to Lisbon',
      currencyCode: 'EUR',
    });
    const mAlice = await seedMember(client, {
      userId: alice.id,
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
    const everyone = [mAlice.id, mBob.id, mCarol.id, mDave.id];

    await seedSplitPayment(client, {
      groupId: lisbon.id,
      payerMemberId: mAlice.id,
      title: 'Pizza',
      fullAmount: 2450,
      splitType: 'equal',
      paidAt: daysAgoAt(0, 1),
      participants: equally([mAlice.id, mBob.id, mCarol.id]),
    });
    await seedSplitPayment(client, {
      groupId: lisbon.id,
      payerMemberId: mBob.id,
      title: 'Groceries at Pingo Doce',
      fullAmount: 6385,
      splitType: 'shares',
      paidAt: daysAgoAt(1, 18),
      participants: [
        { memberId: mAlice.id, inputValue: 1 },
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
        { memberId: mAlice.id, inputValue: 2500 },
        { memberId: mBob.id, inputValue: 2500 },
        { memberId: mCarol.id, inputValue: 2000 },
        { memberId: mDave.id, inputValue: 2000 },
      ],
    });
    await seedSplitPayment(client, {
      groupId: lisbon.id,
      payerMemberId: mAlice.id,
      title: 'Airbnb, 4 nights in Alfama',
      fullAmount: 48000,
      splitType: 'percent',
      paidAt: daysAgoAt(3, 12),
      participants: [
        { memberId: mAlice.id, inputValue: 3000 },
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
    const fAlice = await seedMember(client, {
      userId: alice.id,
      groupId: flat.id,
    });
    const flatmates = [fCarol.id, fAlice.id];

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
      payerMemberId: fAlice.id,
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
      userId: alice.id,
      groupId: ski.id,
      isModerator: true,
    });

    const invite = await seedInviteLink(client, {
      groupId: lisbon.id,
      singleUse: false,
    });

    console.log('\n✅ Dev DB seeded.\n');
    console.log('  Trip to Lisbon (EUR), Alice moderator');
    console.log(
      '    Members:  Alice (you), Bob, Carol, Dédé (nickname of David)',
    );
    console.log(
      '    Payments: Pizza (today, equal, Dédé left out), Groceries (yesterday, shares),',
    );
    console.log(
      '              Fado night (yesterday, exact), Airbnb (3 days ago, percent), Pastéis (4 days ago, equal)',
    );
    console.log('  Flatshare (EUR), Alice plain member, no ⋯ menu');
    console.log('    Payments: Electricity, Internet');
    console.log(
      '  Ski 2027 (CHF), Alice moderator, no payments (empty state)\n',
    );
    console.log('  Invite link (Trip to Lisbon):');
    console.log(`    http://localhost:4200/join?token=${invite.token}\n`);
    console.log('  To log in as Alice, set this cookie in your browser:');
    console.log(`    session_token = ${sessionToken}`);
    console.log(
      '    (DevTools → Application → Cookies → http://localhost:4200)\n',
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
