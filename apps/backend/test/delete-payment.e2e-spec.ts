import { type CreatePaymentResponse } from '@ardoise/shared';
import { type INestApplication } from '@nestjs/common';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type Client } from 'pg';
import request from 'supertest';
import { type App } from 'supertest/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { seedGroup, seedMember, seedSession, seedUser } from './helpers/seed';
import { setupTestApp } from './helpers/test-app';

describe('DeletePayment', () => {
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

  async function seedGroupWithPayment() {
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
    return { aliceToken, bobToken, payment };
  }

  it('returns 401 without a session', async () => {
    const { payment } = await seedGroupWithPayment();

    await request(app.getHttpServer())
      .delete(`/payments/${String(payment.id)}`)
      .expect(401);
  });

  it('returns 404 for an unknown payment', async () => {
    const { aliceToken } = await seedGroupWithPayment();

    const response = await request(app.getHttpServer())
      .delete('/payments/9999')
      .set('Cookie', `session_token=${aliceToken}`)
      .expect(404);

    expect(response.body).toMatchObject({ error: 'PAYMENT_NOT_FOUND' });
  });

  it('returns 403 for a non-member and keeps the payment', async () => {
    const { payment } = await seedGroupWithPayment();
    const carol = await seedUser(pgClient, { name: 'carol' });
    const { token: carolToken } = await seedSession(pgClient, {
      userId: carol.id,
    });

    await request(app.getHttpServer())
      .delete(`/payments/${String(payment.id)}`)
      .set('Cookie', `session_token=${carolToken}`)
      .expect(403);

    const { rows } = await pgClient.query(
      'SELECT id FROM payment WHERE id = $1',
      [payment.id],
    );
    expect(rows).toHaveLength(1);
  });

  it('lets a member who is not the payer delete the payment and its shares', async () => {
    const { bobToken, payment } = await seedGroupWithPayment();

    await request(app.getHttpServer())
      .delete(`/payments/${String(payment.id)}`)
      .set('Cookie', `session_token=${bobToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/payments/${String(payment.id)}`)
      .set('Cookie', `session_token=${bobToken}`)
      .expect(404);
    const { rows } = await pgClient.query(
      'SELECT 1 FROM payment_share WHERE payment_id = $1',
      [payment.id],
    );
    expect(rows).toHaveLength(0);
  });
});
