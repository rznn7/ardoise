import {
  type CreatePaymentResponse,
  type PaymentResponse,
  type PaymentShareResponse,
} from '@ardoise/shared';
import { type INestApplication } from '@nestjs/common';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type Client } from 'pg';
import request from 'supertest';
import { type App } from 'supertest/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { seedGroup, seedMember, seedSession, seedUser } from './helpers/seed';
import { setupTestApp } from './helpers/test-app';

describe('UpdatePayment', () => {
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

  async function seedGroupWithEqualPayment() {
    const alice = await seedUser(pgClient, { name: 'alice' });
    const bob = await seedUser(pgClient, { name: 'bob' });
    const { token: aliceToken } = await seedSession(pgClient, {
      userId: alice.id,
    });
    const { token: bobToken } = await seedSession(pgClient, {
      userId: bob.id,
    });
    const group = await seedGroup(pgClient);
    const aliceMember = await seedMember(pgClient, {
      userId: alice.id,
      groupId: group.id,
    });
    const bobMember = await seedMember(pgClient, {
      userId: bob.id,
      groupId: group.id,
    });
    const created = await request(app.getHttpServer())
      .post('/payments')
      .set('Cookie', `session_token=${aliceToken}`)
      .send({
        groupId: group.id,
        payerMemberId: aliceMember.id,
        title: 'dinner',
        paidAt: '2026-08-16T19:00:00.000Z',
        fullAmount: 4200,
        splitType: 'equal',
        participants: [
          { memberId: aliceMember.id },
          { memberId: bobMember.id },
        ],
      })
      .expect(201);
    const { payment } = created.body as CreatePaymentResponse;
    return { aliceToken, bobToken, aliceMember, bobMember, payment };
  }

  const equalBody = (
    payerMemberId: number,
    memberIds: number[],
    fullAmount: number,
  ) => ({
    payerMemberId,
    title: 'dinner',
    paidAt: '2026-08-16T19:00:00.000Z',
    fullAmount,
    splitType: 'equal',
    participants: memberIds.map((memberId) => ({ memberId })),
  });

  async function storedShares(token: string, paymentId: number) {
    const response = await request(app.getHttpServer())
      .get(`/payment-shares/by-payment/${String(paymentId)}`)
      .set('Cookie', `session_token=${token}`)
      .expect(200);
    return response.body as PaymentShareResponse[];
  }

  it('returns 401 without a cookie', async () => {
    await request(app.getHttpServer()).put('/payments/1').send({}).expect(401);
  });

  it('returns 404 for an unknown payment', async () => {
    const { aliceToken, aliceMember } = await seedGroupWithEqualPayment();

    const response = await request(app.getHttpServer())
      .put('/payments/9999')
      .set('Cookie', `session_token=${aliceToken}`)
      .send(equalBody(aliceMember.id, [aliceMember.id], 1000))
      .expect(404);

    expect(response.body).toEqual({ error: 'PAYMENT_NOT_FOUND' });
  });

  it('returns 403 when the caller is not a member of the payment group', async () => {
    const { payment, aliceMember, bobMember } =
      await seedGroupWithEqualPayment();
    const carol = await seedUser(pgClient, { name: 'carol' });
    const { token } = await seedSession(pgClient, { userId: carol.id });

    await request(app.getHttpServer())
      .put(`/payments/${String(payment.id)}`)
      .set('Cookie', `session_token=${token}`)
      .send(equalBody(aliceMember.id, [aliceMember.id, bobMember.id], 3000))
      .expect(403);

    const stored = await pgClient.query<{ full_amount: number }>(
      `SELECT full_amount FROM payment WHERE id = $1`,
      [payment.id],
    );
    expect(stored.rows).toEqual([{ full_amount: 4200 }]);
    const shares = await pgClient.query<{ amount: number }>(
      `SELECT amount FROM payment_share WHERE payment_id = $1 ORDER BY member_id`,
      [payment.id],
    );
    expect(shares.rows.map((s) => s.amount)).toEqual([2100, 2100]);
  });

  it('lets any member, not only the payer, change the amount', async () => {
    const { bobToken, aliceMember, bobMember, payment } =
      await seedGroupWithEqualPayment();

    const response = await request(app.getHttpServer())
      .put(`/payments/${String(payment.id)}`)
      .set('Cookie', `session_token=${bobToken}`)
      .send(equalBody(aliceMember.id, [aliceMember.id, bobMember.id], 3000))
      .expect(200);

    const body = response.body as CreatePaymentResponse;
    expect(body.payment.fullAmount).toBe(3000);
    expect(body.shares.map((s) => s.amount)).toEqual([1500, 1500]);
    const stored = await storedShares(bobToken, payment.id);
    expect(stored.map((s) => s.amount)).toEqual([1500, 1500]);
  });

  it('replaces the shares when switching from equal to exact', async () => {
    const { aliceToken, aliceMember, payment } =
      await seedGroupWithEqualPayment();

    await request(app.getHttpServer())
      .put(`/payments/${String(payment.id)}`)
      .set('Cookie', `session_token=${aliceToken}`)
      .send({
        payerMemberId: aliceMember.id,
        title: 'dinner',
        paidAt: '2026-08-16T19:00:00.000Z',
        fullAmount: 4200,
        splitType: 'exact',
        participants: [{ memberId: aliceMember.id, inputValue: 4200 }],
      })
      .expect(200);

    const stored = await storedShares(aliceToken, payment.id);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      memberId: aliceMember.id,
      amount: 4200,
    });
  });

  it('leaves the payment and shares unchanged when the exact total mismatches', async () => {
    const { aliceToken, aliceMember, bobMember, payment } =
      await seedGroupWithEqualPayment();

    const response = await request(app.getHttpServer())
      .put(`/payments/${String(payment.id)}`)
      .set('Cookie', `session_token=${aliceToken}`)
      .send({
        payerMemberId: aliceMember.id,
        title: 'changed',
        paidAt: '2026-08-16T19:00:00.000Z',
        fullAmount: 5000,
        splitType: 'exact',
        participants: [
          { memberId: aliceMember.id, inputValue: 1000 },
          { memberId: bobMember.id, inputValue: 1000 },
        ],
      })
      .expect(400);

    expect(response.body).toEqual({ error: 'EXACT_TOTAL_MISMATCH' });
    const unchanged = await request(app.getHttpServer())
      .get(`/payments/${String(payment.id)}`)
      .set('Cookie', `session_token=${aliceToken}`)
      .expect(200);
    expect(unchanged.body as PaymentResponse).toMatchObject({
      title: 'dinner',
      fullAmount: 4200,
      splitType: 'equal',
    });
    const stored = await storedShares(aliceToken, payment.id);
    expect(stored.map((s) => s.amount)).toEqual([2100, 2100]);
  });

  it('returns 400 PAYER_NOT_IN_GROUP when the payer is outside the group', async () => {
    const { aliceToken, aliceMember, payment } =
      await seedGroupWithEqualPayment();

    const response = await request(app.getHttpServer())
      .put(`/payments/${String(payment.id)}`)
      .set('Cookie', `session_token=${aliceToken}`)
      .send(equalBody(9999, [aliceMember.id], 1000))
      .expect(400);

    expect(response.body).toEqual({ error: 'PAYER_NOT_IN_GROUP' });
  });
});
