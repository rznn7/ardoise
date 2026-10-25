import { type ChildProcess, execSync, spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

export const BACKEND_PORT = 3100;
export const FRONTEND_PORT = 4300;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const backendDir = resolve(repoRoot, 'apps/backend');
const frontendDir = resolve(repoRoot, 'apps/frontend');

async function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((done) => setTimeout(done, 500));
    }
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function start(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
): ChildProcess {
  const child = spawn(command, args, {
    cwd,
    env,
    detached: true,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  child.unref();
  return child;
}

function stop(child: ChildProcess): void {
  if (child.pid === undefined) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    return;
  }
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const databaseUrl = container.getConnectionUri();

  const pool = new Pool({ connectionString: databaseUrl });
  await migrate(drizzle(pool), {
    migrationsFolder: resolve(backendDir, 'src/shared/database/migrations'),
  });
  await pool.end();

  execSync('pnpm --filter @ardoise/backend... build', {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  const origin = `http://localhost:${String(FRONTEND_PORT)}`;
  const backend = start('node', ['dist/main'], backendDir, {
    ...process.env,
    DATABASE_URL: databaseUrl,
    PORT: String(BACKEND_PORT),
    RP_ID: 'localhost',
    RP_NAME: 'Ardoise',
    EXPECTED_ORIGIN: origin,
  });
  const frontend = start(
    'pnpm',
    [
      'exec',
      'ng',
      'serve',
      '--port',
      String(FRONTEND_PORT),
      '--proxy-config',
      resolve(repoRoot, 'apps/e2e/proxy.e2e.conf.json'),
    ],
    frontendDir,
    process.env,
  );

  const teardown = async (): Promise<void> => {
    stop(frontend);
    stop(backend);
    await container.stop();
  };

  try {
    await waitForHttp(`http://localhost:${String(BACKEND_PORT)}`, 60_000);
    await waitForHttp(origin, 180_000);
  } catch (error) {
    await teardown();
    throw error;
  }

  process.env['E2E_DATABASE_URL'] = databaseUrl;
  return teardown;
}
