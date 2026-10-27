import { type CreatePaymentResponse } from '@ardoise/shared';
import { type INestApplication } from '@nestjs/common';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type Client } from 'pg';
import request from 'supertest';
import { type App } from 'supertest/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { seedGroup, seedMember, seedSession, seedUser } from './helpers/seed';
import { setupTestApp } from './helpers/test-app';

describe('CreatePayment', () => {
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

  async function seedGroupWithTwoMembers() {
    const alice = await seedUser(pgClient, { name: 'alice' });
    const bob = await seedUser(pgClient, { name: 'bob' });
    const { token } = await seedSession(pgClient, { userId: alice.id });
    const group = await seedGroup(pgClient);
    const aliceMember = await seedMember(pgClient, {
      userId: alice.id,
      groupId: group.id,
    });
    const bobMember = await seedMember(pgClient, {
      userId: bob.id,
      groupId: group.id,
    });
    return { token, group, aliceMember, bobMember };
  }

  it('returns 401 without a cookie', async () => {
    // WHEN / THEN
    await request(app.getHttpServer()).post('/payments').send({}).expect(401);
  });

  it('creates a payment with an equal split and persists the shares', async () => {
    // GIVEN a group where alice and bob are both members
    const { token, group, aliceMember, bobMember } =
      await seedGroupWithTwoMembers();

    // WHEN alice records a 42.00 dinner split equally
    const response = await request(app.getHttpServer())
      .post('/payments')
      .set('Cookie', `session_token=${token}`)
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

    // THEN the response carries the payment and both resolved shares
    const body = response.body as CreatePaymentResponse;
    expect(body.payment).toEqual({
      id: expect.any(Number) as number,
      groupId: group.id,
      payerMemberId: aliceMember.id,
      title: 'dinner',
      paidAt: '2026-08-16T19:00:00.000Z',
      fullAmount: 4200,
      splitType: 'equal',
      createdAt: expect.stringMatching(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      ) as string,
    });
    expect(body.shares).toHaveLength(2);
    expect(body.shares.map((s) => s.amount)).toEqual([2100, 2100]);

    // AND the shares are actually in the database, summing to the full amount
    const { rows } = await pgClient.query<{ sum: string; count: string }>(
      `SELECT SUM(amount)::text AS sum, COUNT(*)::text AS count
       FROM payment_share WHERE payment_id = $1`,
      [body.payment.id],
    );
    expect(rows[0]).toEqual({ sum: '4200', count: '2' });
  });

  it('creates a percent split', async () => {
    // GIVEN a group where alice and bob are both members
    const { token, group, aliceMember, bobMember } =
      await seedGroupWithTwoMembers();

    // WHEN alice records a 30/70 percent split of 10.00
    const response = await request(app.getHttpServer())
      .post('/payments')
      .set('Cookie', `session_token=${token}`)
      .send({
        groupId: group.id,
        payerMemberId: aliceMember.id,
        title: 'taxi',
        paidAt: '2026-08-16T19:00:00.000Z',
        fullAmount: 1000,
        splitType: 'percent',
        participants: [
          { memberId: aliceMember.id, inputValue: 3000 },
          { memberId: bobMember.id, inputValue: 7000 },
        ],
      })
      .expect(201);

    // THEN the shares are 3.00 and 7.00
    const body = response.body as CreatePaymentResponse;
    expect(body.shares.map((s) => s.amount)).toEqual([300, 700]);
  });

  it('creates a shares split', async () => {
    // GIVEN a group where alice and bob are both members
    const { token, group, aliceMember, bobMember } =
      await seedGroupWithTwoMembers();

    // WHEN alice records a 1:3 weighted split of 8.00
    const response = await request(app.getHttpServer())
      .post('/payments')
      .set('Cookie', `session_token=${token}`)
      .send({
        groupId: group.id,
        payerMemberId: aliceMember.id,
        title: 'rent',
        paidAt: '2026-08-16T19:00:00.000Z',
        fullAmount: 800,
        splitType: 'shares',
        participants: [
          { memberId: aliceMember.id, inputValue: 1 },
          { memberId: bobMember.id, inputValue: 3 },
        ],
      })
      .expect(201);

    // THEN the shares are 2.00 and 6.00, each with the weight it was given
    const body = response.body as CreatePaymentResponse;
    expect(body.shares).toEqual([
      {
        paymentId: body.payment.id,
        memberId: aliceMember.id,
        inputValue: 1,
        amount: 200,
      },
      {
        paymentId: body.payment.id,
        memberId: bobMember.id,
        inputValue: 3,
        amount: 600,
      },
    ]);
  });

  it('creates an exact split', async () => {
    // GIVEN a group where alice and bob are both members
    const { token, group, aliceMember, bobMember } =
      await seedGroupWithTwoMembers();

    // WHEN alice records exact amounts totalling 10.00
    const response = await request(app.getHttpServer())
      .post('/payments')
      .set('Cookie', `session_token=${token}`)
      .send({
        groupId: group.id,
        payerMemberId: aliceMember.id,
        title: 'groceries',
        paidAt: '2026-08-16T19:00:00.000Z',
        fullAmount: 1000,
        splitType: 'exact',
        participants: [
          { memberId: aliceMember.id, inputValue: 250 },
          { memberId: bobMember.id, inputValue: 750 },
        ],
      })
      .expect(201);

    // THEN the shares match the amounts given
    const body = response.body as CreatePaymentResponse;
    expect(body.shares.map((s) => s.amount)).toEqual([250, 750]);
  });

  it('lets a member record a payment on behalf of another member', async () => {
    // GIVEN alice is logged in and bob is a member of the same group
    const { token, group, aliceMember, bobMember } =
      await seedGroupWithTwoMembers();

    // WHEN alice records a payment that bob made
    const response = await request(app.getHttpServer())
      .post('/payments')
      .set('Cookie', `session_token=${token}`)
      .send({
        groupId: group.id,
        payerMemberId: bobMember.id,
        title: 'bob paid',
        paidAt: '2026-08-16T19:00:00.000Z',
        fullAmount: 1000,
        splitType: 'equal',
        participants: [
          { memberId: aliceMember.id },
          { memberId: bobMember.id },
        ],
      })
      .expect(201);

    // THEN the payer is bob, not alice
    const body = response.body as CreatePaymentResponse;
    expect(body.payment.payerMemberId).toBe(bobMember.id);
  });

  it('returns 403 when the caller is not a member of the group', async () => {
    // GIVEN mallory has a session but is not in the target group
    const { group, aliceMember } = await seedGroupWithTwoMembers();
    const mallory = await seedUser(pgClient, { name: 'mallory' });
    const { token: malloryToken } = await seedSession(pgClient, {
      userId: mallory.id,
    });

    // WHEN / THEN
    const response = await request(app.getHttpServer())
      .post('/payments')
      .set('Cookie', `session_token=${malloryToken}`)
      .send({
        groupId: group.id,
        payerMemberId: aliceMember.id,
        title: 'intrusion',
        paidAt: '2026-08-16T19:00:00.000Z',
        fullAmount: 1000,
        splitType: 'equal',
        participants: [{ memberId: aliceMember.id }],
      })
      .expect(403);

    expect(response.body).toEqual({ error: 'NOT_A_MEMBER' });
    const payments = await pgClient.query(`SELECT id FROM payment`);
    expect(payments.rows).toHaveLength(0);
  });

  it('returns 403 when the groupId does not exist', async () => {
    // GIVEN a caller with a valid session but a groupId that names no group
    const { token, aliceMember } = await seedGroupWithTwoMembers();

    // WHEN / THEN
    const response = await request(app.getHttpServer())
      .post('/payments')
      .set('Cookie', `session_token=${token}`)
      .send({
        groupId: 999_999,
        payerMemberId: aliceMember.id,
        title: 'phantom group',
        paidAt: '2026-08-16T19:00:00.000Z',
        fullAmount: 1000,
        splitType: 'equal',
        participants: [{ memberId: aliceMember.id }],
      })
      .expect(403);

    expect(response.body).toEqual({ error: 'NOT_A_MEMBER' });
    const payments = await pgClient.query(`SELECT id FROM payment`);
    expect(payments.rows).toHaveLength(0);
  });

  it('returns 400 when the payer belongs to another group', async () => {
    // GIVEN a payer member id that belongs to a different group
    const { token, group, aliceMember } = await seedGroupWithTwoMembers();
    const outsider = await seedUser(pgClient, { name: 'outsider' });
    const otherGroup = await seedGroup(pgClient, { name: 'other' });
    const outsiderMember = await seedMember(pgClient, {
      userId: outsider.id,
      groupId: otherGroup.id,
    });

    // WHEN / THEN
    const response = await request(app.getHttpServer())
      .post('/payments')
      .set('Cookie', `session_token=${token}`)
      .send({
        groupId: group.id,
        payerMemberId: outsiderMember.id,
        title: 'wrong payer',
        paidAt: '2026-08-16T19:00:00.000Z',
        fullAmount: 1000,
        splitType: 'equal',
        participants: [{ memberId: aliceMember.id }],
      })
      .expect(400);

    expect(response.body).toEqual({ error: 'PAYER_NOT_IN_GROUP' });
  });

  it('returns 400 when a participant belongs to another group', async () => {
    // GIVEN a participant member id that belongs to a different group
    const { token, group, aliceMember } = await seedGroupWithTwoMembers();
    const outsider = await seedUser(pgClient, { name: 'outsider' });
    const otherGroup = await seedGroup(pgClient, { name: 'other' });
    const outsiderMember = await seedMember(pgClient, {
      userId: outsider.id,
      groupId: otherGroup.id,
    });

    // WHEN / THEN
    const response = await request(app.getHttpServer())
      .post('/payments')
      .set('Cookie', `session_token=${token}`)
      .send({
        groupId: group.id,
        payerMemberId: aliceMember.id,
        title: 'wrong participant',
        paidAt: '2026-08-16T19:00:00.000Z',
        fullAmount: 1000,
        splitType: 'equal',
        participants: [
          { memberId: aliceMember.id },
          { memberId: outsiderMember.id },
        ],
      })
      .expect(400);

    expect(response.body).toEqual({ error: 'PARTICIPANT_NOT_IN_GROUP' });
  });

  it('returns 400 when percent shares do not total 100%', async () => {
    // GIVEN percentages summing to 90%
    const { token, group, aliceMember, bobMember } =
      await seedGroupWithTwoMembers();

    // WHEN / THEN
    const response = await request(app.getHttpServer())
      .post('/payments')
      .set('Cookie', `session_token=${token}`)
      .send({
        groupId: group.id,
        payerMemberId: aliceMember.id,
        title: 'bad percent',
        paidAt: '2026-08-16T19:00:00.000Z',
        fullAmount: 1000,
        splitType: 'percent',
        participants: [
          { memberId: aliceMember.id, inputValue: 3000 },
          { memberId: bobMember.id, inputValue: 6000 },
        ],
      })
      .expect(400);

    expect(response.body).toEqual({ error: 'PERCENT_TOTAL_MISMATCH' });
  });

  it('returns 400 when the same participant appears twice', async () => {
    // GIVEN a duplicated participant
    const { token, group, aliceMember } = await seedGroupWithTwoMembers();

    // WHEN / THEN
    const response = await request(app.getHttpServer())
      .post('/payments')
      .set('Cookie', `session_token=${token}`)
      .send({
        groupId: group.id,
        payerMemberId: aliceMember.id,
        title: 'duplicate',
        paidAt: '2026-08-16T19:00:00.000Z',
        fullAmount: 1000,
        splitType: 'equal',
        participants: [
          { memberId: aliceMember.id },
          { memberId: aliceMember.id },
        ],
      })
      .expect(400);

    expect(response.body).toEqual({ error: 'DUPLICATE_PARTICIPANT' });
  });

  it('rejects a fullAmount above the int4 ceiling without hitting the driver', async () => {
    // GIVEN an amount larger than a Postgres integer column can hold
    const { token, group, aliceMember } = await seedGroupWithTwoMembers();

    // WHEN / THEN it is a clean 400 from zod, never a 500 from pg
    await request(app.getHttpServer())
      .post('/payments')
      .set('Cookie', `session_token=${token}`)
      .send({
        groupId: group.id,
        payerMemberId: aliceMember.id,
        title: 'overflow',
        paidAt: '2026-08-16T19:00:00.000Z',
        fullAmount: 2_147_483_648,
        splitType: 'equal',
        participants: [{ memberId: aliceMember.id }],
      })
      .expect(400);
  });

  it('leaves no payment row behind when the request is rejected', async () => {
    // GIVEN a request that will fail the participant check
    const { token, group, aliceMember } = await seedGroupWithTwoMembers();
    const outsider = await seedUser(pgClient, { name: 'outsider' });
    const otherGroup = await seedGroup(pgClient, { name: 'other' });
    const outsiderMember = await seedMember(pgClient, {
      userId: outsider.id,
      groupId: otherGroup.id,
    });

    // WHEN the request is rejected
    await request(app.getHttpServer())
      .post('/payments')
      .set('Cookie', `session_token=${token}`)
      .send({
        groupId: group.id,
        payerMemberId: aliceMember.id,
        title: 'rolled back',
        paidAt: '2026-08-16T19:00:00.000Z',
        fullAmount: 1000,
        splitType: 'equal',
        participants: [
          { memberId: aliceMember.id },
          { memberId: outsiderMember.id },
        ],
      })
      .expect(400);

    // THEN neither a payment nor any shares were written
    const payments = await pgClient.query(`SELECT id FROM payment`);
    const shares = await pgClient.query(`SELECT payment_id FROM payment_share`);
    expect(payments.rows).toHaveLength(0);
    expect(shares.rows).toHaveLength(0);
  });
});
