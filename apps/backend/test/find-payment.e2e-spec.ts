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

describe('FindPayment', () => {
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

  it('returns 401 without a cookie', async () => {
    // WHEN / THEN
    await request(app.getHttpServer()).get('/payments/1').expect(401);
  });

  it('returns the payment to a member of its group', async () => {
    // GIVEN alice is a member of the group that owns the payment
    const alice = await seedUser(pgClient, { name: 'alice' });
    const { token } = await seedSession(pgClient, { userId: alice.id });
    const group = await seedGroup(pgClient);
    const aliceMember = await seedMember(pgClient, {
      userId: alice.id,
      groupId: group.id,
    });
    const payment = await seedPayment(pgClient, {
      groupId: group.id,
      payerMemberId: aliceMember.id,
      title: 'dinner',
      fullAmount: 4200,
    });

    // WHEN / THEN
    const response = await request(app.getHttpServer())
      .get(`/payments/${String(payment.id)}`)
      .set('Cookie', `session_token=${token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: payment.id,
      groupId: group.id,
      title: 'dinner',
      fullAmount: 4200,
    });
  });

  it('returns 403 and leaks nothing when the caller is not a member of the group', async () => {
    // GIVEN mallory has a valid session but belongs to a different group
    const mallory = await seedUser(pgClient, { name: 'mallory' });
    const { token } = await seedSession(pgClient, { userId: mallory.id });
    const otherGroup = await seedGroup(pgClient, { name: 'mallory-group' });
    await seedMember(pgClient, {
      userId: mallory.id,
      groupId: otherGroup.id,
    });

    const victim = await seedUser(pgClient, { name: 'victim' });
    const victimGroup = await seedGroup(pgClient, { name: 'victim-group' });
    const victimMember = await seedMember(pgClient, {
      userId: victim.id,
      groupId: victimGroup.id,
    });
    const payment = await seedPayment(pgClient, {
      groupId: victimGroup.id,
      payerMemberId: victimMember.id,
      title: 'secret dinner',
      fullAmount: 999999,
    });

    // WHEN / THEN
    const response = await request(app.getHttpServer())
      .get(`/payments/${String(payment.id)}`)
      .set('Cookie', `session_token=${token}`)
      .expect(403);

    expect(response.body).toEqual({ error: 'NOT_A_MEMBER' });
    expect(JSON.stringify(response.body)).not.toContain('secret dinner');
  });

  it('returns 404 for a payment that does not exist', async () => {
    // GIVEN a valid session
    const alice = await seedUser(pgClient, { name: 'alice' });
    const { token } = await seedSession(pgClient, { userId: alice.id });

    // WHEN / THEN
    await request(app.getHttpServer())
      .get('/payments/99999')
      .set('Cookie', `session_token=${token}`)
      .expect(404);
  });

  describe('shares by payment', () => {
    it('returns 401 without a cookie', async () => {
      // WHEN / THEN
      await request(app.getHttpServer())
        .get('/payment-shares/by-payment/1')
        .expect(401);
    });

    it('returns the shares to a member of the owning group', async () => {
      // GIVEN alice is a member of the group that owns the payment
      const alice = await seedUser(pgClient, { name: 'alice' });
      const { token } = await seedSession(pgClient, { userId: alice.id });
      const group = await seedGroup(pgClient);
      const aliceMember = await seedMember(pgClient, {
        userId: alice.id,
        groupId: group.id,
      });
      const payment = await seedPayment(pgClient, {
        groupId: group.id,
        payerMemberId: aliceMember.id,
        fullAmount: 1000,
      });
      await seedPaymentShare(pgClient, {
        paymentId: payment.id,
        memberId: aliceMember.id,
        amount: 1000,
      });

      // WHEN / THEN
      const response = await request(app.getHttpServer())
        .get(`/payment-shares/by-payment/${String(payment.id)}`)
        .set('Cookie', `session_token=${token}`)
        .expect(200);

      const body = response.body as unknown[];
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({
        paymentId: payment.id,
        memberId: aliceMember.id,
        amount: 1000,
      });
    });

    it('returns 403 when the caller is not a member of the owning group', async () => {
      // GIVEN mallory has a valid session but belongs to a different group
      const mallory = await seedUser(pgClient, { name: 'mallory' });
      const { token } = await seedSession(pgClient, { userId: mallory.id });
      const otherGroup = await seedGroup(pgClient, { name: 'mallory-group' });
      await seedMember(pgClient, {
        userId: mallory.id,
        groupId: otherGroup.id,
      });

      const victim = await seedUser(pgClient, { name: 'victim' });
      const victimGroup = await seedGroup(pgClient, { name: 'victim-group' });
      const victimMember = await seedMember(pgClient, {
        userId: victim.id,
        groupId: victimGroup.id,
      });
      const payment = await seedPayment(pgClient, {
        groupId: victimGroup.id,
        payerMemberId: victimMember.id,
        fullAmount: 999999,
      });
      await seedPaymentShare(pgClient, {
        paymentId: payment.id,
        memberId: victimMember.id,
        amount: 999999,
      });

      // WHEN / THEN
      const response = await request(app.getHttpServer())
        .get(`/payment-shares/by-payment/${String(payment.id)}`)
        .set('Cookie', `session_token=${token}`)
        .expect(403);

      expect(response.body).toEqual({ error: 'NOT_A_MEMBER' });
    });

    it('returns 404 when the payment does not exist', async () => {
      // GIVEN a valid session
      const alice = await seedUser(pgClient, { name: 'alice' });
      const { token } = await seedSession(pgClient, { userId: alice.id });

      // WHEN / THEN
      await request(app.getHttpServer())
        .get('/payment-shares/by-payment/99999')
        .set('Cookie', `session_token=${token}`)
        .expect(404);
    });
  });
});
