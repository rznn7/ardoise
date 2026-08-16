import { randomUUID } from 'node:crypto';

import { type Client } from 'pg';

export async function seedUser(
  client: Client,
  opts: {
    name?: string;
    role?: 'user' | 'admin';
    webauthnUserId?: string;
  } = {},
): Promise<{ id: number }> {
  const { name = 'john', role = 'user', webauthnUserId = randomUUID() } = opts;

  const { rows } = await client.query<{ id: number }>(
    `INSERT INTO users (name, role, webauthn_user_id) VALUES ($1, $2, $3) RETURNING id`,
    [name, role, webauthnUserId],
  );
  return { id: rows[0]!.id };
}

export async function seedSession(
  client: Client,
  opts: {
    userId: number;
    token?: string;
    expiresInDays?: number;
    revoked?: boolean;
  },
): Promise<{ token: string }> {
  const {
    userId,
    token = randomUUID(),
    expiresInDays = 7,
    revoked = false,
  } = opts;

  await client.query(
    `INSERT INTO session (token, user_id, issued_at, expires_at, revoked_at)
     VALUES ($1, $2, NOW(), NOW() + ($3 || ' days')::interval, ${revoked ? `NOW() - INTERVAL '1 minute'` : 'NULL'})`,
    [token, userId, String(expiresInDays)],
  );
  return { token };
}

export async function seedGroup(
  client: Client,
  opts: { name?: string; currencyCode?: string } = {},
): Promise<{ id: number }> {
  const { name = 'group', currencyCode = 'EUR' } = opts;

  const { rows } = await client.query<{ id: number }>(
    `INSERT INTO expense_group (name, currency_code) VALUES ($1, $2) RETURNING id`,
    [name, currencyCode],
  );
  return { id: rows[0]!.id };
}

export async function seedMember(
  client: Client,
  opts: {
    userId: number;
    groupId: number;
    nickname?: string | null;
    isModerator?: boolean;
  },
): Promise<{ id: number }> {
  const { userId, groupId, nickname = null, isModerator = false } = opts;

  const { rows } = await client.query<{ id: number }>(
    `INSERT INTO member (user_id, group_id, nickname, is_moderator) VALUES ($1, $2, $3, $4) RETURNING id`,
    [userId, groupId, nickname, isModerator],
  );
  return { id: rows[0]!.id };
}

export async function seedInviteLink(
  client: Client,
  opts: {
    groupId: number;
    token?: string;
    singleUse?: boolean;
    expiresInDays?: number;
    burnedByUserId?: number;
  },
): Promise<{ id: number; token: string }> {
  const {
    groupId,
    token = randomUUID(),
    singleUse = true,
    expiresInDays = 7,
    burnedByUserId,
  } = opts;

  const burned = burnedByUserId !== undefined;
  const { rows } = await client.query<{ id: number }>(
    `INSERT INTO invite_link (group_id, token, single_use, expires_at, burned_by_user_id, burned_at)
     VALUES ($1, $2, $3, NOW() + ($4 || ' days')::interval, $5, ${burned ? 'NOW()' : 'NULL'})
     RETURNING id`,
    [groupId, token, singleUse, String(expiresInDays), burnedByUserId ?? null],
  );
  return { id: rows[0]!.id, token };
}

export async function seedPasskey(
  client: Client,
  opts: {
    userId: number;
    credentialId?: string;
    publicKey?: Uint8Array;
    counter?: number;
  },
): Promise<{ id: number }> {
  const {
    userId,
    credentialId = 'cred-1',
    publicKey = Buffer.from([1, 2, 3, 4]),
    counter = 0,
  } = opts;

  const { rows } = await client.query<{ id: number }>(
    `INSERT INTO passkey (user_id, credential_id, public_key, counter) VALUES ($1, $2, $3, $4) RETURNING id`,
    [userId, credentialId, publicKey, counter],
  );
  return { id: rows[0]!.id };
}
