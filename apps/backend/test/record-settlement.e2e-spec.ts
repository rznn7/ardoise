import { type SettlementResponse } from '@ardoise/shared';
import { type INestApplication } from '@nestjs/common';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type Client } from 'pg';
import request from 'supertest';
import { type App } from 'supertest/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { seedGroup, seedMember, seedSession, seedUser } from './helpers/seed';
import { setupTestApp } from './helpers/test-app';

describe('RecordSettlement', () => {
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

  async function seedTrio() {
    const group = await seedGroup(pgClient);
    const tom = await seedPerson(group.id, 'tom');
    const lea = await seedPerson(group.id, 'lea');
    const max = await seedPerson(group.id, 'max');
    return { group, tom, lea, max };
  }

  const record = (token: string | null, body: object) => {
    const req = request(app.getHttpServer()).post('/settlements');
    return (token ? req.set('Cookie', `session_token=${token}`) : req).send(
      body,
    );
  };

  it('returns 401 without a session', async () => {
    const { group, tom, lea } = await seedTrio();

    await record(null, {
      groupId: group.id,
      fromMemberId: tom.member.id,
      toMemberId: lea.member.id,
      amount: 3000,
    }).expect(401);
  });

  it('records a repayment made by the caller', async () => {
    const { group, tom, lea } = await seedTrio();

    const response = await record(tom.token, {
      groupId: group.id,
      fromMemberId: tom.member.id,
      toMemberId: lea.member.id,
      amount: 3000,
    }).expect(201);

    const body = response.body as SettlementResponse;
    expect(body).toMatchObject({
      groupId: group.id,
      fromMemberId: tom.member.id,
      toMemberId: lea.member.id,
      amount: 3000,
      createdByMemberId: tom.member.id,
    });
    expect(Number.isNaN(Date.parse(body.settledAt))).toBe(false);
  });

  it('records a repayment received by the caller', async () => {
    const { group, tom, lea } = await seedTrio();

    const response = await record(lea.token, {
      groupId: group.id,
      fromMemberId: tom.member.id,
      toMemberId: lea.member.id,
      amount: 3000,
    }).expect(201);

    expect((response.body as SettlementResponse).createdByMemberId).toBe(
      lea.member.id,
    );
  });

  it('refuses a member who is neither side', async () => {
    const { group, tom, lea, max } = await seedTrio();

    const response = await record(max.token, {
      groupId: group.id,
      fromMemberId: tom.member.id,
      toMemberId: lea.member.id,
      amount: 3000,
    }).expect(403);

    expect(response.body).toEqual({ error: 'NOT_INVOLVED_IN_SETTLEMENT' });
  });

  it('refuses a caller outside the group', async () => {
    const { group, tom, lea } = await seedTrio();
    const otherGroup = await seedGroup(pgClient);
    const outsider = await seedPerson(otherGroup.id, 'outsider');

    await record(outsider.token, {
      groupId: group.id,
      fromMemberId: tom.member.id,
      toMemberId: lea.member.id,
      amount: 3000,
    }).expect(403);
  });

  it('refuses a member repaying themselves', async () => {
    const { group, tom } = await seedTrio();

    const response = await record(tom.token, {
      groupId: group.id,
      fromMemberId: tom.member.id,
      toMemberId: tom.member.id,
      amount: 3000,
    }).expect(400);

    expect(response.body).toEqual({ error: 'INVALID_SETTLEMENT' });
  });

  it('refuses a zero amount', async () => {
    const { group, tom, lea } = await seedTrio();

    await record(tom.token, {
      groupId: group.id,
      fromMemberId: tom.member.id,
      toMemberId: lea.member.id,
      amount: 0,
    }).expect(400);
  });

  it('refuses members of another group', async () => {
    const { group, tom } = await seedTrio();
    const otherGroup = await seedGroup(pgClient);
    const stranger = await seedPerson(otherGroup.id, 'stranger');

    const response = await record(tom.token, {
      groupId: group.id,
      fromMemberId: tom.member.id,
      toMemberId: stranger.member.id,
      amount: 3000,
    }).expect(400);

    expect(response.body).toEqual({ error: 'SETTLEMENT_MEMBER_NOT_IN_GROUP' });
  });
});
