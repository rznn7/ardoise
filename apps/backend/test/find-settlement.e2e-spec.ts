import { type SettlementResponse } from '@ardoise/shared';
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

describe('FindSettlement', () => {
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

  const find = (token: string, id: number) =>
    request(app.getHttpServer())
      .get(`/settlements/${String(id)}`)
      .set('Cookie', `session_token=${token}`);

  it('shows a repayment to any member of the group', async () => {
    const group = await seedGroup(pgClient);
    const tom = await seedPerson(group.id, 'tom');
    const lea = await seedPerson(group.id, 'lea');
    const max = await seedPerson(group.id, 'max');
    const settlement = await seedSettlement(pgClient, {
      groupId: group.id,
      fromMemberId: tom.member.id,
      toMemberId: lea.member.id,
      amount: 3000,
      settledAt: new Date('2026-10-20T10:00:00.000Z'),
    });

    const response = await find(max.token, settlement.id).expect(200);

    expect(response.body as SettlementResponse).toMatchObject({
      id: settlement.id,
      fromMemberId: tom.member.id,
      toMemberId: lea.member.id,
      amount: 3000,
      settledAt: '2026-10-20T10:00:00.000Z',
    });
  });

  it('refuses a caller outside the group', async () => {
    const group = await seedGroup(pgClient);
    const tom = await seedPerson(group.id, 'tom');
    const lea = await seedPerson(group.id, 'lea');
    const settlement = await seedSettlement(pgClient, {
      groupId: group.id,
      fromMemberId: tom.member.id,
      toMemberId: lea.member.id,
      amount: 3000,
    });
    const otherGroup = await seedGroup(pgClient);
    const outsider = await seedPerson(otherGroup.id, 'outsider');

    await find(outsider.token, settlement.id).expect(403);
  });

  it('returns 404 for an unknown repayment', async () => {
    const group = await seedGroup(pgClient);
    const tom = await seedPerson(group.id, 'tom');

    await find(tom.token, 999).expect(404);
  });
});
