import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';
import { type MemberTotals } from 'src/balance/domain/balance';
import { BalanceRepository } from 'src/balance/domain/balance-repository';
import {
  type Database,
  DATABASE_CONNECTION,
} from 'src/shared/database/database.module';
import {
  member,
  payment,
  paymentShare,
  settlement,
} from 'src/shared/database/schema';

@Injectable()
export class BalanceRepositoryDrizzle implements BalanceRepository {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  async totalsByGroup(groupId: number): Promise<MemberTotals[]> {
    return this.totals()
      .where(eq(member.groupId, groupId))
      .orderBy(asc(member.id));
  }

  async totalsOfUser(
    userId: number,
  ): Promise<(MemberTotals & { readonly groupId: number })[]> {
    return this.totals()
      .where(eq(member.userId, userId))
      .orderBy(asc(member.groupId));
  }

  private totals() {
    const paidByMember = this.database
      .select({
        memberId: payment.payerMemberId,
        paid: sql<number>`SUM(${payment.fullAmount})`.as('paid'),
      })
      .from(payment)
      .groupBy(payment.payerMemberId)
      .as('paid_by_member');
    const owedByMember = this.database
      .select({
        memberId: paymentShare.memberId,
        owed: sql<number>`SUM(${paymentShare.amount})`.as('owed'),
      })
      .from(paymentShare)
      .groupBy(paymentShare.memberId)
      .as('owed_by_member');
    const settledOutByMember = this.database
      .select({
        memberId: settlement.fromMemberId,
        settledOut: sql<number>`SUM(${settlement.amount})`.as('settled_out'),
      })
      .from(settlement)
      .groupBy(settlement.fromMemberId)
      .as('settled_out_by_member');
    const settledInByMember = this.database
      .select({
        memberId: settlement.toMemberId,
        settledIn: sql<number>`SUM(${settlement.amount})`.as('settled_in'),
      })
      .from(settlement)
      .groupBy(settlement.toMemberId)
      .as('settled_in_by_member');

    return this.database
      .select({
        memberId: member.id,
        groupId: member.groupId,
        paid: sql<number>`COALESCE(${paidByMember.paid}, 0)::int`,
        owed: sql<number>`COALESCE(${owedByMember.owed}, 0)::int`,
        settledOut: sql<number>`COALESCE(${settledOutByMember.settledOut}, 0)::int`,
        settledIn: sql<number>`COALESCE(${settledInByMember.settledIn}, 0)::int`,
      })
      .from(member)
      .leftJoin(paidByMember, eq(paidByMember.memberId, member.id))
      .leftJoin(owedByMember, eq(owedByMember.memberId, member.id))
      .leftJoin(settledOutByMember, eq(settledOutByMember.memberId, member.id))
      .leftJoin(settledInByMember, eq(settledInByMember.memberId, member.id))
      .$dynamic();
  }
}
