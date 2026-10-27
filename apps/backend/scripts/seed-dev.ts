import 'dotenv/config';

import { Client } from 'pg';

import { seedDemo } from './seed/demo-scenario';

async function main() {
  const origin = process.env['EXPECTED_ORIGIN'];
  if (!origin) throw new Error('EXPECTED_ORIGIN missing');

  const client = new Client({ connectionString: process.env['DATABASE_URL'] });
  await client.connect();

  try {
    const report = await seedDemo(client, { origin });
    const you = report.realAccountCount > 0 ? 'you' : 'Alice';

    console.log('\n✅ Dev DB seeded.\n');
    console.log(`  Real accounts kept: ${report.realAccountCount}`);
    console.log(`  Trip to Lisbon (EUR), ${you} moderator, owed money`);
    console.log(`    Members:  ${you}, Bob, Carol, Dédé (nickname of David)`);
    console.log(
      '    Payments: Pizza (today, equal, Dédé left out), Groceries (yesterday, shares),',
    );
    console.log(
      '              Fado night (yesterday, exact), Airbnb (3 days ago, percent), Pastéis (4 days ago, equal)',
    );
    console.log(
      `  Flatshare (EUR), ${you} plain member, no ⋯ menu, owes money`,
    );
    console.log('    Payments: Electricity, Internet');
    console.log(
      `  Ski 2027 (CHF), ${you} moderator, no payments (empty state)`,
    );
    console.log(
      `  Friday dinners (EUR), ${you} moderator, everything paid back (all settled)\n`,
    );
    console.log('  Invite link (Trip to Lisbon):');
    console.log(`    ${report.inviteUrl}\n`);
    if (report.sessionToken) {
      console.log('  To log in as Alice, set this cookie in your browser:');
      console.log(`    session_token = ${report.sessionToken}`);
      console.log(
        '    (DevTools → Application → Cookies → http://localhost:4200)\n',
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
