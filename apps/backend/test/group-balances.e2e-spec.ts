import { type INestApplication } from '@nestjs/common';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type Client } from 'pg';
import request from 'supertest';
import { type App } from 'supertest/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  seedGroup,
  seedMember,
  seedPayment,
  seedPaymentShare,
  seedSession,
  seedUser,
} from './helpers/seed';
import { setupTestApp } from './helpers/test-app';

describe('GroupBalances', () => {
  let app: INestApplication<App>;
  let pgContainer: StartedPostgreSqlContainer;
  let pgClient: Client;

  beforeAll(async () => {
    ({ app, pgClient, pgContainer } = await setupTestApp());
  }, 30000);

  afterEach(async () => {
    await pgClient.query(
      `TRUNCATE session, users, expense_group, invite_link, passkey, member, payment, payment_share RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await app.close();
    await pgClient.end();
    await pgContainer.stop();
  });

  const seedAliceAndBob = async () => {
    const group = await seedGroup(pgClient);
    const alice = await seedUser(pgClient, { name: 'alice' });
    const bob = await seedUser(pgClient, { name: 'bob' });
    const mAlice = await seedMember(pgClient, {
      userId: alice.id,
      groupId: group.id,
    });
    const mBob = await seedMember(pgClient, {
      userId: bob.id,
      groupId: group.id,
    });
    const { token } = await seedSession(pgClient, { userId: alice.id });
    return { group, mAlice, mBob, token };
  };

  const getBalances = (groupId: number, token: string) =>
    request(app.getHttpServer())
      .get(`/expense-groups/${String(groupId)}/balances`)
      .set('Cookie', `session_token=${token}`);

  it('returns 401 without a cookie', async () => {
    await request(app.getHttpServer())
      .get('/expense-groups/1/balances')
      .expect(401);
  });

  it('returns 403 when the caller is not a member', async () => {
    const outsider = await seedUser(pgClient, { name: 'eve' });
    const group = await seedGroup(pgClient);
    const { token } = await seedSession(pgClient, { userId: outsider.id });

    const response = await getBalances(group.id, token).expect(403);

    expect(response.body).toEqual({ error: 'NOT_A_MEMBER' });
  });

  it('returns every member at zero for a group without payments', async () => {
    const { group, mAlice, mBob, token } = await seedAliceAndBob();

    const response = await getBalances(group.id, token).expect(200);

    expect(response.body).toEqual({
      balances: [
        { memberId: mAlice.id, amount: 0 },
        { memberId: mBob.id, amount: 0 },
      ],
      transfers: [],
    });
  });

  it('credits the payer and has the other member repay their share', async () => {
    const { group, mAlice, mBob, token } = await seedAliceAndBob();
    const { id: paymentId } = await seedPayment(pgClient, {
      groupId: group.id,
      payerMemberId: mAlice.id,
      fullAmount: 3000,
    });
    await seedPaymentShare(pgClient, {
      paymentId,
      memberId: mAlice.id,
      amount: 1500,
    });
    await seedPaymentShare(pgClient, {
      paymentId,
      memberId: mBob.id,
      amount: 1500,
    });

    const response = await getBalances(group.id, token).expect(200);

    expect(response.body).toEqual({
      balances: [
        { memberId: mAlice.id, amount: 1500 },
        { memberId: mBob.id, amount: -1500 },
      ],
      transfers: [
        { fromMemberId: mBob.id, toMemberId: mAlice.id, amount: 1500 },
      ],
    });
  });

  it('credits the full amount to a payer left out of their own split', async () => {
    const { group, mAlice, mBob, token } = await seedAliceAndBob();
    const { id: paymentId } = await seedPayment(pgClient, {
      groupId: group.id,
      payerMemberId: mAlice.id,
      fullAmount: 2000,
    });
    await seedPaymentShare(pgClient, {
      paymentId,
      memberId: mBob.id,
      amount: 2000,
    });

    const response = await getBalances(group.id, token).expect(200);

    expect(response.body).toMatchObject({
      balances: [
        { memberId: mAlice.id, amount: 2000 },
        { memberId: mBob.id, amount: -2000 },
      ],
    });
  });

  it('includes a member with nothing paid or owed at zero', async () => {
    const { group, mAlice, mBob, token } = await seedAliceAndBob();
    const carol = await seedUser(pgClient, { name: 'carol' });
    const mCarol = await seedMember(pgClient, {
      userId: carol.id,
      groupId: group.id,
    });
    const { id: paymentId } = await seedPayment(pgClient, {
      groupId: group.id,
      payerMemberId: mAlice.id,
      fullAmount: 1000,
    });
    await seedPaymentShare(pgClient, {
      paymentId,
      memberId: mBob.id,
      amount: 1000,
    });

    const response = await getBalances(group.id, token).expect(200);

    expect(response.body).toMatchObject({
      balances: [
        { memberId: mAlice.id, amount: 1000 },
        { memberId: mBob.id, amount: -1000 },
        { memberId: mCarol.id, amount: 0 },
      ],
    });
  });
});
