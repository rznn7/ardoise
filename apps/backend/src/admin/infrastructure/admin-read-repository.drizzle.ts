import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import {
  type AdminGroupRead,
  type AdminOverviewRead,
  type AdminReadRepository,
  type AdminUserRead,
} from 'src/admin/domain/admin-read-repository';
import {
  type Database,
  DATABASE_CONNECTION,
} from 'src/shared/database/database.module';
import {
  expenseGroup,
  inviteLink,
  member,
  passkey,
  payment,
  session,
  users,
} from 'src/shared/database/schema';

@Injectable()
export class AdminReadRepositoryDrizzle implements AdminReadRepository {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  async overview(): Promise<AdminOverviewRead> {
    const groupCounts = this.database
      .select({ userId: member.userId, groupCount: count().as('group_count') })
      .from(member)
      .groupBy(member.userId)
      .as('group_counts');
    const lastSignIns = this.lastSignIns();
    const memberCounts = this.memberCounts();
    const paymentCounts = this.database
      .select({
        groupId: payment.groupId,
        paymentCount: count().as('payment_count'),
      })
      .from(payment)
      .groupBy(payment.groupId)
      .as('payment_counts');

    const [userRows, groupRows, [paymentTotal]] = await Promise.all([
      this.database
        .select({
          id: users.id,
          name: users.name,
          role: users.role,
          createdAt: users.createdAt,
          lastSignInAt: lastSignIns.lastSignInAt,
          groupCount: sql<number>`COALESCE(${groupCounts.groupCount}, 0)::int`,
        })
        .from(users)
        .leftJoin(groupCounts, eq(groupCounts.userId, users.id))
        .leftJoin(lastSignIns, eq(lastSignIns.userId, users.id))
        .orderBy(asc(users.name), asc(users.id)),
      this.database
        .select({
          id: expenseGroup.id,
          name: expenseGroup.name,
          currencyCode: expenseGroup.currencyCode,
          createdAt: expenseGroup.createdAt,
          memberCount: sql<number>`COALESCE(${memberCounts.memberCount}, 0)::int`,
          paymentCount: sql<number>`COALESCE(${paymentCounts.paymentCount}, 0)::int`,
        })
        .from(expenseGroup)
        .leftJoin(memberCounts, eq(memberCounts.groupId, expenseGroup.id))
        .leftJoin(paymentCounts, eq(paymentCounts.groupId, expenseGroup.id))
        .orderBy(asc(expenseGroup.name), asc(expenseGroup.id)),
      this.database.select({ total: count() }).from(payment),
    ]);

    return {
      counts: {
        users: userRows.length,
        groups: groupRows.length,
        payments: paymentTotal?.total ?? 0,
      },
      users: userRows.map((row) => ({
        ...row,
        lastSignInAt: toDate(row.lastSignInAt),
      })),
      groups: groupRows,
    };
  }

  async user(userId: number, now: Date): Promise<AdminUserRead | null> {
    const lastSignIns = this.lastSignIns();
    const [user] = await this.database
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
        lastSignInAt: lastSignIns.lastSignInAt,
        passkeyCount: sql<number>`(SELECT COUNT(*) FROM ${passkey} WHERE ${passkey.userId} = ${users.id})::int`,
      })
      .from(users)
      .leftJoin(lastSignIns, eq(lastSignIns.userId, users.id))
      .where(eq(users.id, userId));
    if (!user) return null;

    const memberCounts = this.memberCounts();
    const [groups, activeSessions] = await Promise.all([
      this.database
        .select({
          groupId: expenseGroup.id,
          name: expenseGroup.name,
          currencyCode: expenseGroup.currencyCode,
          isModerator: member.isModerator,
          memberCount: sql<number>`COALESCE(${memberCounts.memberCount}, 0)::int`,
        })
        .from(member)
        .innerJoin(expenseGroup, eq(expenseGroup.id, member.groupId))
        .leftJoin(memberCounts, eq(memberCounts.groupId, expenseGroup.id))
        .where(eq(member.userId, userId))
        .orderBy(asc(expenseGroup.name), asc(expenseGroup.id)),
      this.database
        .select({
          id: session.id,
          token: session.token,
          issuedAt: session.issuedAt,
          expiresAt: session.expiresAt,
        })
        .from(session)
        .where(
          and(
            eq(session.userId, userId),
            isNull(session.revokedAt),
            gt(session.expiresAt, now),
          ),
        )
        .orderBy(desc(session.issuedAt), desc(session.id)),
    ]);

    return {
      user: { ...user, lastSignInAt: toDate(user.lastSignInAt) },
      groups,
      activeSessions,
    };
  }

  async group(groupId: number): Promise<AdminGroupRead | null> {
    const [group] = await this.database
      .select({
        id: expenseGroup.id,
        name: expenseGroup.name,
        currencyCode: expenseGroup.currencyCode,
        createdAt: expenseGroup.createdAt,
        paymentCount: sql<number>`(SELECT COUNT(*) FROM ${payment} WHERE ${payment.groupId} = ${expenseGroup.id})::int`,
        totalSpent: sql<number>`(SELECT COALESCE(SUM(${payment.fullAmount}), 0) FROM ${payment} WHERE ${payment.groupId} = ${expenseGroup.id})::int`,
      })
      .from(expenseGroup)
      .where(eq(expenseGroup.id, groupId));
    if (!group) return null;

    const [members, links] = await Promise.all([
      this.database
        .select({
          memberId: member.id,
          userId: member.userId,
          name: sql<string>`coalesce(${member.nickname}, ${users.name})`,
          isModerator: member.isModerator,
        })
        .from(member)
        .innerJoin(users, eq(users.id, member.userId))
        .where(eq(member.groupId, groupId))
        .orderBy(
          asc(sql`coalesce(${member.nickname}, ${users.name})`),
          asc(member.id),
        ),
      this.database
        .select({ link: inviteLink, burnedByName: users.name })
        .from(inviteLink)
        .leftJoin(users, eq(users.id, inviteLink.burnedByUserId))
        .where(eq(inviteLink.groupId, groupId))
        .orderBy(desc(inviteLink.createdAt), desc(inviteLink.id)),
    ]);

    return {
      group,
      members,
      inviteLinks: links.map(({ link, burnedByName }) => ({
        id: link.id,
        groupId: link.groupId,
        token: link.token,
        singleUse: link.singleUse,
        burnedByUserId: link.burnedByUserId,
        expiresAt: link.expiresAt,
        burnedAt: link.burnedAt,
        revokedAt: link.revokedAt,
        createdAt: link.createdAt,
        burnedByName,
      })),
    };
  }

  private lastSignIns() {
    return this.database
      .select({
        userId: session.userId,
        lastSignInAt: sql<Date | string>`MAX(${session.issuedAt})`.as(
          'last_sign_in_at',
        ),
      })
      .from(session)
      .groupBy(session.userId)
      .as('last_sign_ins');
  }

  private memberCounts() {
    return this.database
      .select({
        groupId: member.groupId,
        memberCount: count().as('member_count'),
      })
      .from(member)
      .groupBy(member.groupId)
      .as('member_counts');
  }
}

const toDate = (value: Date | string | null): Date | null =>
  value === null ? null : new Date(value);
