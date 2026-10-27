import { randomBytes } from 'node:crypto';

import { Client } from 'pg';

const TABLES = [
  'settlement',
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

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

async function withClient<T>(run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({
    connectionString: process.env['E2E_DATABASE_URL'],
  });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

export async function resetDb(): Promise<void> {
  await withClient((client) =>
    client.query(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`),
  );
}

export async function seedGroupWithInvite(
  name: string,
): Promise<{ groupId: number; token: string }> {
  return withClient(async (client) => {
    const group = await client.query<{ id: number }>(
      `INSERT INTO expense_group (name, currency_code) VALUES ($1, 'EUR') RETURNING id`,
      [name],
    );
    const groupId = group.rows[0]?.id;
    if (groupId === undefined) throw new Error('Group insert returned no id');
    const token = randomBytes(32).toString('base64url');
    await client.query(
      `INSERT INTO invite_link (group_id, token, single_use, expires_at) VALUES ($1, $2, false, $3)`,
      [groupId, token, new Date(Date.now() + SEVEN_DAYS_MS)],
    );
    return { groupId, token };
  });
}

export async function expireInvite(token: string): Promise<void> {
  await withClient((client) =>
    client.query(
      `UPDATE invite_link SET expires_at = NOW() - INTERVAL '1 day' WHERE token = $1`,
      [token],
    ),
  );
}

export async function makeNewestUserAdmin(): Promise<void> {
  await withClient((client) =>
    client.query(
      `UPDATE users SET role = 'admin' WHERE id = (SELECT MAX(id) FROM users)`,
    ),
  );
}

export async function seedPayments(
  groupId: number,
  count: number,
  oldestTitle: string,
): Promise<void> {
  await withClient(async (client) => {
    const { rows } = await client.query<{ id: number; payer: number }>(
      `INSERT INTO payment (group_id, payer_member_id, title, full_amount, split_type, paid_at)
       SELECT $1, m.id, CASE WHEN i = $2 THEN $3 ELSE 'Payment ' || i END, 1000, 'equal', NOW() - (i || ' days')::interval
       FROM generate_series(1, $2) AS i, (SELECT MAX(id) AS id FROM member WHERE group_id = $1) AS m
       RETURNING id, payer_member_id AS payer`,
      [groupId, count, oldestTitle],
    );
    await client.query(
      `INSERT INTO payment_share (payment_id, member_id, input_value, amount)
       SELECT unnest($1::int[]), unnest($2::int[]), 0, 1000`,
      [rows.map((row) => row.id), rows.map((row) => row.payer)],
    );
  });
}
