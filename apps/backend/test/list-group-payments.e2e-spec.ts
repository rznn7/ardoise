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
  seedSession,
  seedUser,
} from './helpers/seed';
import { setupTestApp } from './helpers/test-app';

describe('ListGroupPayments', () => {
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

  const seedMemberWithSession = async () => {
    const user = await seedUser(pgClient, { name: 'alice' });
    const group = await seedGroup(pgClient);
    const member = await seedMember(pgClient, {
      userId: user.id,
      groupId: group.id,
    });
    const { token } = await seedSession(pgClient, { userId: user.id });
    return { user, group, member, token };
  };

  it('returns 401 without a cookie', async () => {
    await request(app.getHttpServer())
      .get('/expense-groups/1/payments')
      .expect(401);
  });

  it('returns 403 when the caller is not a member', async () => {
    const outsider = await seedUser(pgClient, { name: 'alice' });
    const group = await seedGroup(pgClient);
    const { token } = await seedSession(pgClient, { userId: outsider.id });

    const response = await request(app.getHttpServer())
      .get(`/expense-groups/${String(group.id)}/payments`)
      .set('Cookie', `session_token=${token}`)
      .expect(403);

    expect(response.body).toEqual({ error: 'NOT_A_MEMBER' });
  });

  it('returns an empty list for a group without payments', async () => {
    const { group, token } = await seedMemberWithSession();

    const response = await request(app.getHttpServer())
      .get(`/expense-groups/${String(group.id)}/payments`)
      .set('Cookie', `session_token=${token}`)
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('orders payments by paidAt descending', async () => {
    const { group, member, token } = await seedMemberWithSession();
    const middle = await seedPayment(pgClient, {
      groupId: group.id,
      payerMemberId: member.id,
      paidAt: new Date('2026-10-20T12:00:00Z'),
    });
    const newest = await seedPayment(pgClient, {
      groupId: group.id,
      payerMemberId: member.id,
      paidAt: new Date('2026-10-25T12:00:00Z'),
    });
    const oldest = await seedPayment(pgClient, {
      groupId: group.id,
      payerMemberId: member.id,
      paidAt: new Date('2026-10-01T12:00:00Z'),
    });

    const response = await request(app.getHttpServer())
      .get(`/expense-groups/${String(group.id)}/payments`)
      .set('Cookie', `session_token=${token}`)
      .expect(200);

    expect((response.body as { id: number }[]).map((p) => p.id)).toEqual([
      newest.id,
      middle.id,
      oldest.id,
    ]);
  });

  it('orders payments with the same paidAt by id descending', async () => {
    const { group, member, token } = await seedMemberWithSession();
    const paidAt = new Date('2026-10-20T12:00:00Z');
    const first = await seedPayment(pgClient, {
      groupId: group.id,
      payerMemberId: member.id,
      paidAt,
    });
    const second = await seedPayment(pgClient, {
      groupId: group.id,
      payerMemberId: member.id,
      paidAt,
    });

    const response = await request(app.getHttpServer())
      .get(`/expense-groups/${String(group.id)}/payments`)
      .set('Cookie', `session_token=${token}`)
      .expect(200);

    expect((response.body as { id: number }[]).map((p) => p.id)).toEqual([
      second.id,
      first.id,
    ]);
  });

  it('does not include payments of another group', async () => {
    const { group, member, token } = await seedMemberWithSession();
    const otherGroup = await seedGroup(pgClient);
    const otherUser = await seedUser(pgClient, { name: 'bob' });
    const otherMember = await seedMember(pgClient, {
      userId: otherUser.id,
      groupId: otherGroup.id,
    });
    const own = await seedPayment(pgClient, {
      groupId: group.id,
      payerMemberId: member.id,
    });
    await seedPayment(pgClient, {
      groupId: otherGroup.id,
      payerMemberId: otherMember.id,
    });

    const response = await request(app.getHttpServer())
      .get(`/expense-groups/${String(group.id)}/payments`)
      .set('Cookie', `session_token=${token}`)
      .expect(200);

    expect((response.body as { id: number }[]).map((p) => p.id)).toEqual([
      own.id,
    ]);
  });
});
