import 'dotenv/config';

import { Client } from 'pg';

import {
  seedGroup,
  seedInviteLink,
  seedMember,
  seedPasskey,
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

async function seedPayment(
  client: Client,
  opts: {
    payerMemberId: number;
    groupId: number;
    title: string;
    fullAmount: number;
    shares: { memberId: number; amount: number }[];
  },
): Promise<{ id: number }> {
  const { rows } = await client.query<{ id: number }>(
    `INSERT INTO payment (payer_member_id, group_id, title, paid_at, full_amount, split_type)
     VALUES ($1, $2, $3, NOW(), $4, 'equal') RETURNING id`,
    [opts.payerMemberId, opts.groupId, opts.title, opts.fullAmount],
  );
  const paymentId = rows[0]!.id;

  for (const share of opts.shares) {
    await client.query(
      `INSERT INTO payment_share (payment_id, member_id, input_value, amount)
       VALUES ($1, $2, $3, $3)`,
      [paymentId, share.memberId, share.amount],
    );
  }
  return { id: paymentId };
}

async function main() {
  const client = new Client({ connectionString: process.env['DATABASE_URL'] });
  await client.connect();

  try {
    await client.query(
      `TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`,
    );

    // Primary user — this is "you". A dummy passkey is added so the account
    // looks complete, but you log in via the seeded session cookie below.
    const alice = await seedUser(client, { name: 'Alice' });
    await seedPasskey(client, { userId: alice.id, credentialId: 'dev-alice' });
    const { token: sessionToken } = await seedSession(client, {
      userId: alice.id,
    });

    const bob = await seedUser(client, { name: 'Bob' });
    const carol = await seedUser(client, { name: 'Carol' });

    const group = await seedGroup(client, {
      name: 'Trip to Lisbon',
      currencyCode: 'EUR',
    });

    const mAlice = await seedMember(client, {
      userId: alice.id,
      groupId: group.id,
      isModerator: true,
    });
    const mBob = await seedMember(client, {
      userId: bob.id,
      groupId: group.id,
    });
    const mCarol = await seedMember(client, {
      userId: carol.id,
      groupId: group.id,
    });

    // Amounts are in cents. Two equal-split payments across the three members.
    await seedPayment(client, {
      payerMemberId: mAlice.id,
      groupId: group.id,
      title: 'Hotel',
      fullAmount: 30000,
      shares: [
        { memberId: mAlice.id, amount: 10000 },
        { memberId: mBob.id, amount: 10000 },
        { memberId: mCarol.id, amount: 10000 },
      ],
    });
    await seedPayment(client, {
      payerMemberId: mBob.id,
      groupId: group.id,
      title: 'Dinner',
      fullAmount: 9000,
      shares: [
        { memberId: mAlice.id, amount: 3000 },
        { memberId: mBob.id, amount: 3000 },
        { memberId: mCarol.id, amount: 3000 },
      ],
    });

    const invite = await seedInviteLink(client, {
      groupId: group.id,
      singleUse: false,
    });

    console.log('\n✅ Dev DB seeded.\n');
    console.log('  Group:   Trip to Lisbon (EUR)');
    console.log('  Members: Alice (you, moderator), Bob, Carol');
    console.log('  Payments: Hotel €300, Dinner €90 (equal split)\n');
    console.log('  Invite link:');
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
