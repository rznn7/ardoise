import { type INestApplication } from '@nestjs/common';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type Client } from 'pg';
import request from 'supertest';
import { type App } from 'supertest/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  seedGroup,
  seedMember,
  seedSession,
  seedSettlement,
  seedUser,
} from './helpers/seed';
import { setupTestApp } from './helpers/test-app';

describe('UndoSettlement', () => {
  let app: INestApplication<App>;
  let pgContainer: StartedPostgreSqlContainer;
  let pgClient: Client;

  beforeAll(async () => {
    ({ app, pgClient, pgContainer } = await setupTestApp());
  }, 30000);

  afterEach(async () => {
    await pgClient.query(
      `TRUNCATE session, users, expense_group, member, payment, payment_share, settlement RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await app.close();
    await pgClient.end();
    await pgContainer.stop();
  });

  async function seedPerson(groupId: number, name: string) {
    const user = await seedUser(pgClient, { name });
    const { token } = await seedSession(pgClient, { userId: user.id });
    const member = await seedMember(pgClient, { userId: user.id, groupId });
    return { token, member };
  }

  async function seedRepayment() {
    const group = await seedGroup(pgClient);
    const tom = await seedPerson(group.id, 'tom');
    const lea = await seedPerson(group.id, 'lea');
    const max = await seedPerson(group.id, 'max');
    const settlement = await seedSettlement(pgClient, {
      groupId: group.id,
      fromMemberId: tom.member.id,
      toMemberId: lea.member.id,
      amount: 3000,
    });
    return { tom, lea, max, settlement };
  }

  const undo = (token: string, id: number) =>
    request(app.getHttpServer())
      .delete(`/settlements/${String(id)}`)
      .set('Cookie', `session_token=${token}`);

  const remaining = async (): Promise<number> => {
    const { rows } = await pgClient.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM settlement',
    );
    return Number(rows[0]?.count);
  };

  it('lets the member who paid undo it', async () => {
    const { tom, settlement } = await seedRepayment();

    await undo(tom.token, settlement.id).expect(204);

    expect(await remaining()).toBe(0);
  });

  it('lets the member who was paid undo it', async () => {
    const { lea, settlement } = await seedRepayment();

    await undo(lea.token, settlement.id).expect(204);

    expect(await remaining()).toBe(0);
  });

  it('refuses a member who is neither side', async () => {
    const { max, settlement } = await seedRepayment();

    const response = await undo(max.token, settlement.id).expect(403);

    expect(response.body).toEqual({ error: 'NOT_INVOLVED_IN_SETTLEMENT' });
    expect(await remaining()).toBe(1);
  });

  it('refuses a caller outside the group', async () => {
    const { settlement } = await seedRepayment();
    const otherGroup = await seedGroup(pgClient);
    const outsider = await seedPerson(otherGroup.id, 'outsider');

    await undo(outsider.token, settlement.id).expect(403);

    expect(await remaining()).toBe(1);
  });

  it('returns 404 once already undone', async () => {
    const { tom, settlement } = await seedRepayment();
    await undo(tom.token, settlement.id).expect(204);

    const response = await undo(tom.token, settlement.id).expect(404);

    expect(response.body).toEqual({ error: 'SETTLEMENT_NOT_FOUND' });
  });
});
