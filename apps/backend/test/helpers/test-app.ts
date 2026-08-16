import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import cookieParser from 'cookie-parser';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client, Pool } from 'pg';
import { AppModule } from 'src/app.module';
import { type App } from 'supertest/types';

export async function setupTestApp(opts?: {
  overrides?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
}): Promise<{
  app: INestApplication<App>;
  pgClient: Client;
  pgContainer: StartedPostgreSqlContainer;
}> {
  const pgContainer = await new PostgreSqlContainer(
    'postgres:16-alpine',
  ).start();

  const pgClient = await new Client({
    host: pgContainer.getHost(),
    port: pgContainer.getPort(),
    database: pgContainer.getDatabase(),
    user: pgContainer.getUsername(),
    password: pgContainer.getPassword(),
  }).connect();

  process.env['DATABASE_URL'] = pgContainer.getConnectionUri();

  const migrationPool = new Pool({
    connectionString: pgContainer.getConnectionUri(),
  });
  const migrationDb = drizzle(migrationPool);
  await migrate(migrationDb, {
    migrationsFolder: 'src/shared/database/migrations',
  });
  await migrationPool.end();

  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (opts?.overrides) builder = opts.overrides(builder);

  const moduleFixture = await builder.compile();
  const app: INestApplication<App> = moduleFixture.createNestApplication();
  app.use(cookieParser());
  await app.init();

  return { app, pgClient, pgContainer };
}
