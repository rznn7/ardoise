import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/server';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import cookieParser from 'cookie-parser';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client, Pool } from 'pg';
import {
  PASSKEY_VERIFIER,
  type PasskeyVerifier,
} from 'src/domain/auth/passkey-verifier';
import request from 'supertest';
import { type App } from 'supertest/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from './../src/app.module';
import { BeginRegistrationResponse } from '@ardoise/shared';

const fakeVerifier: PasskeyVerifier = {
  generateRegistrationOptions: ({ webauthnUserId }) =>
    Promise.resolve({
      challenge: 'test-challenge',
      rp: { name: 'test', id: 'localhost' },
      user: { id: webauthnUserId, name: 'x', displayName: 'x' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
    } as PublicKeyCredentialCreationOptionsJSON),
  verifyRegistration: () =>
    Promise.resolve({
      credentialId: 'cred-1',
      publicKey: new Uint8Array([1, 2, 3]),
      counter: 0,
    }),
};

describe('Authentication', () => {
  let app: INestApplication<App>;
  let pgContainer: StartedPostgreSqlContainer;
  let pgClient: Client;

  beforeAll(async () => {
    pgContainer = await new PostgreSqlContainer('postgres:16-alpine').start();
    pgClient = await new Client({
      host: pgContainer.getHost(),
      port: pgContainer.getPort(),
      database: pgContainer.getDatabase(),
      user: pgContainer.getUsername(),
      password: pgContainer.getPassword(),
    }).connect();
    process.env.DATABASE_URL = pgContainer.getConnectionUri();
    const migrationPool = new Pool({
      connectionString: pgContainer.getConnectionUri(),
    });
    const migrationDb = drizzle(migrationPool);
    await migrate(migrationDb, {
      migrationsFolder: 'src/infrastructure/database/migrations',
    });
    await migrationPool.end();

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PASSKEY_VERIFIER)
      .useValue(fakeVerifier)
      .compile();

    app = moduleFixture.createNestApplication();

    app.use(cookieParser());
    await app.init();
  });

  afterEach(async () => {
    await pgClient.query(
      `TRUNCATE session, users, expense_group, invite_link, passkey, member RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await app.close();
    await pgClient.end();
    await pgContainer.stop();
  });

  describe('register', () => {
    it('registers', async () => {
      // GIVEN
      const firstGroupId = (
        await pgClient.query<{ id: number }>(
          `INSERT INTO expense_group (name, currency_code) VALUES ($1, $2) RETURNING id`,
          ['summer trip 2026', 'EUR'],
        )
      ).rows[0].id;
      await pgClient.query(
        `INSERT INTO invite_link (group_id, token, expires_at ) VALUES ($1, $2, NOW() + INTERVAL '7 days') RETURNING id`,
        [firstGroupId, 'registration-token-1'],
      );

      // WHEN
      const beginResponse = await request(app.getHttpServer())
        .post('/auth/register/begin')
        .send({ inviteToken: 'registration-token-1' })
        .expect(200);

      const beginBody = beginResponse.body as BeginRegistrationResponse;

      await request(app.getHttpServer())
        .post('/auth/register/complete')
        .send({
          registrationState: beginBody.registrationState,
          attestation: {},
          name: 'john',
        })
        .expect(204);

      // THEN
      const createdUser = (
        await pgClient.query<{ id: number }>(`SELECT * FROM users`)
      ).rows[0];
      const createdPasskey = (
        await pgClient.query<object>(`SELECT * FROM passkey`)
      ).rows[0];
      const createdMember = (
        await pgClient.query<object>(`SELECT * FROM member`)
      ).rows[0];
      const consumedInvite = (
        await pgClient.query<{ consumed_at: string }>(
          `SELECT * FROM invite_link`,
        )
      ).rows[0];

      expect(createdUser).toMatchObject({
        name: 'john',
        role: 'user',
        webauthn_user_id: beginBody.registrationState.webauthnUserId,
      });
      expect(createdPasskey).toMatchObject({
        user_id: createdUser.id,
        credential_id: 'cred-1',
        counter: 0,
        last_used_at: null,
      });
      expect(createdMember).toMatchObject({
        user_id: createdUser.id,
        group_id: firstGroupId,
        nickname: null,
        is_moderator: false,
      });
      expect(consumedInvite).toMatchObject({
        consumed_by_user_id: createdUser.id,
      });
      expect(consumedInvite.consumed_at).not.toBeNull();
    });
  });

  describe('logout', () => {
    it('without token', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(204);
    });

    it('with token', async () => {
      // GIVEN
      const { rows } = await pgClient.query<{ id: number }>(
        `INSERT INTO users (name, webauthn_user_id) VALUES ($1, $2) RETURNING id`,
        ['john', 'webauthn-1'],
      );
      await pgClient.query(
        `INSERT INTO session (token, user_id, issued_at, expires_at) VALUES ($1, $2, NOW(), NOW() + INTERVAL '7 days')`,
        ['c19b19f2d4fb4f499a281779498b3677', rows[0].id],
      );

      // WHEN
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', `session_token=c19b19f2d4fb4f499a281779498b3677`)
        .expect(204);

      // ASSERT
      const resRows = (
        await pgClient.query<{ revoked_at: Date | null }>(
          `SELECT revoked_at FROM session WHERE token = $1`,
          ['c19b19f2d4fb4f499a281779498b3677'],
        )
      ).rows;
      expect(resRows[0].revoked_at).not.toBeNull();
    });
  });
});
