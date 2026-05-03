import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import cookieParser from 'cookie-parser';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client, Pool } from 'pg';
import request from 'supertest';
import { type App } from 'supertest/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from './../src/app.module';

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
    }).compile();

    app = moduleFixture.createNestApplication();

    app.use(cookieParser());
    await app.init();
  });

  afterEach(async () => {
    await pgClient.query(
      `TRUNCATE "session", "users" RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await app.close();
    await pgClient.end();
    await pgContainer.stop();
  });

  describe('logout', () => {
    it('without token', () => {
      return request(app.getHttpServer()).post('/auth/logout').expect(204);
    });

    it('with token', async () => {
      // GIVEN
      const { rows } = await pgClient.query<{ id: number }>(
        `INSERT INTO "users" (name, webauthn_user_id) VALUES ($1, $2) RETURNING id`,
        ['john', 'webauthn-1'],
      );
      await pgClient.query(
        `INSERT INTO "session" (token, user_id, issued_at, expires_at) VALUES ($1, $2, NOW(), NOW() + INTERVAL '7 days')`,
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
          `SELECT revoked_at FROM "session" WHERE token = $1`,
          ['c19b19f2d4fb4f499a281779498b3677'],
        )
      ).rows;
      expect(resRows[0].revoked_at).not.toBeNull();
    });
  });
});
