import {
  type AdminGroup,
  type AdminOverview,
  type AdminUser,
} from '@ardoise/shared';
import { type INestApplication } from '@nestjs/common';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type Client } from 'pg';
import request from 'supertest';
import { type App } from 'supertest/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  seedGroup,
  seedInviteLink,
  seedMember,
  seedPasskey,
  seedPayment,
  seedPaymentShare,
  seedSession,
  seedUser,
} from './helpers/seed';
import { setupTestApp } from './helpers/test-app';

describe('Admin read', () => {
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

  async function seedInstance() {
    const admin = await seedUser(pgClient, { name: 'Ada', role: 'admin' });
    const { token: adminToken } = await seedSession(pgClient, {
      userId: admin.id,
      token: 'admin-token',
    });
    const lea = await seedUser(pgClient, { name: 'Léa' });
    const { token: leaToken } = await seedSession(pgClient, {
      userId: lea.id,
      token: 'lea-token',
    });
    await seedSession(pgClient, { userId: lea.id, revoked: true });
    await seedPasskey(pgClient, { userId: lea.id });
    const loner = await seedUser(pgClient, { name: 'Zoé' });
    const trip = await seedGroup(pgClient, { name: 'Trip' });
    const empty = await seedGroup(pgClient, {
      name: 'Empty',
      currencyCode: 'CHF',
    });
    const mAdmin = await seedMember(pgClient, {
      userId: admin.id,
      groupId: trip.id,
      isModerator: true,
    });
    const mLea = await seedMember(pgClient, {
      userId: lea.id,
      groupId: trip.id,
    });
    const { id: paymentId } = await seedPayment(pgClient, {
      groupId: trip.id,
      payerMemberId: mLea.id,
      fullAmount: 3000,
    });
    await seedPaymentShare(pgClient, {
      paymentId,
      memberId: mAdmin.id,
      amount: 1500,
    });
    await seedPaymentShare(pgClient, {
      paymentId,
      memberId: mLea.id,
      amount: 1500,
    });
    return { admin, adminToken, lea, leaToken, loner, trip, empty };
  }

  const get = (path: string, token?: string) => {
    const req = request(app.getHttpServer()).get(path);
    return token ? req.set('Cookie', `session_token=${token}`) : req;
  };

  describe('overview', () => {
    it('returns 401 without a cookie', async () => {
      await get('/admin/overview').expect(401);
    });

    it('returns 403 for a plain user', async () => {
      const { leaToken } = await seedInstance();

      const response = await get('/admin/overview', leaToken).expect(403);

      expect(response.body).toEqual({ error: 'NOT_AN_ADMIN' });
    });

    it('counts and lists users and groups', async () => {
      const { adminToken } = await seedInstance();

      const response = await get('/admin/overview', adminToken).expect(200);
      const body = response.body as AdminOverview;

      expect(body.counts).toEqual({ users: 3, groups: 2, payments: 1 });
      expect(body.users.map((u) => [u.name, u.role, u.groupCount])).toEqual([
        ['Ada', 'admin', 1],
        ['Léa', 'user', 1],
        ['Zoé', 'user', 0],
      ]);
      expect(
        body.groups.map((g) => [g.name, g.memberCount, g.paymentCount]),
      ).toEqual([
        ['Empty', 0, 0],
        ['Trip', 2, 1],
      ]);
    });

    it('overview lists a user with no group', async () => {
      const { adminToken } = await seedInstance();

      const response = await get('/admin/overview', adminToken).expect(200);
      const zoe = (response.body as AdminOverview).users.find(
        (u) => u.name === 'Zoé',
      );

      expect(zoe).toMatchObject({ groupCount: 0, lastSignInAt: null });
    });

    it('gives the last sign-in as the latest session', async () => {
      const { adminToken } = await seedInstance();

      const response = await get('/admin/overview', adminToken).expect(200);
      const lea = (response.body as AdminOverview).users.find(
        (u) => u.name === 'Léa',
      );

      expect(Number.isNaN(Date.parse(lea?.lastSignInAt ?? ''))).toBe(false);
    });
  });

  describe('user', () => {
    it('returns 403 for a plain user', async () => {
      const { leaToken, lea } = await seedInstance();

      await get(`/admin/users/${String(lea.id)}`, leaToken).expect(403);
    });

    it('lists groups with role, size and balance, and active sessions only', async () => {
      const { adminToken, lea, trip } = await seedInstance();

      const response = await get(
        `/admin/users/${String(lea.id)}`,
        adminToken,
      ).expect(200);
      const body = response.body as AdminUser;

      expect(body.user).toMatchObject({
        name: 'Léa',
        role: 'user',
        passkeyCount: 1,
      });
      expect(body.groups).toEqual([
        {
          groupId: trip.id,
          name: 'Trip',
          currencyCode: 'EUR',
          isModerator: false,
          memberCount: 2,
          balance: 1500,
        },
      ]);
      expect(body.sessions).toHaveLength(1);
      expect(body.sessions[0]).toMatchObject({ current: false });
      expect(JSON.stringify(body)).not.toContain('lea-token');
    });

    it("marks the admin's own session as current", async () => {
      const { adminToken, admin } = await seedInstance();

      const response = await get(
        `/admin/users/${String(admin.id)}`,
        adminToken,
      ).expect(200);

      expect(
        (response.body as AdminUser).sessions.map((s) => s.current),
      ).toEqual([true]);
    });

    it('returns 404 for an unknown user', async () => {
      const { adminToken } = await seedInstance();

      await get('/admin/users/999', adminToken).expect(404);
    });
  });

  describe('group', () => {
    it('returns 403 for a plain user', async () => {
      const { leaToken, trip } = await seedInstance();

      await get(`/admin/groups/${String(trip.id)}`, leaToken).expect(403);
    });

    it('lists members with balances and invite links with their status', async () => {
      const { adminToken, trip, lea } = await seedInstance();
      await seedInviteLink(pgClient, {
        groupId: trip.id,
        token: 'active-token',
      });
      await seedInviteLink(pgClient, {
        groupId: trip.id,
        token: 'used-token',
        burnedByUserId: lea.id,
      });
      await seedInviteLink(pgClient, {
        groupId: trip.id,
        token: 'expired-token',
        singleUse: false,
        expiresInDays: -1,
      });
      await seedInviteLink(pgClient, {
        groupId: trip.id,
        token: 'revoked-token',
        revoked: true,
      });

      const response = await get(
        `/admin/groups/${String(trip.id)}`,
        adminToken,
      ).expect(200);
      const body = response.body as AdminGroup;

      expect(body.group).toMatchObject({
        name: 'Trip',
        paymentCount: 1,
        totalSpent: 3000,
      });
      expect(
        body.members.map((m) => [m.name, m.isModerator, m.balance]),
      ).toEqual([
        ['Ada', true, -1500],
        ['Léa', false, 1500],
      ]);
      expect(body.inviteLinks.map((l) => l.status)).toEqual([
        'revoked',
        'expired',
        'used',
        'active',
      ]);
      expect(
        body.inviteLinks.find((l) => l.status === 'used')?.burnedByName,
      ).toBe('Léa');
      expect(JSON.stringify(body)).not.toContain('active-token');
    });

    it('returns 404 for an unknown group', async () => {
      const { adminToken } = await seedInstance();

      await get('/admin/groups/999', adminToken).expect(404);
    });
  });
});
