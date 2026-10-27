import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, lt, or, type SQL, sql } from 'drizzle-orm';
import { type FeedItem, newestFirst } from 'src/feed/domain/feed';
import { FeedRepository } from 'src/feed/domain/feed-repository';
import { toPayment } from 'src/payment/infrastructure/payment-repository.drizzle';
import { toSettlement } from 'src/settlement/infrastructure/settlement-repository.drizzle';
import {
  type Database,
  DATABASE_CONNECTION,
} from 'src/shared/database/database.module';
import { payment, settlement } from 'src/shared/database/schema';
import { type Cursor } from 'src/shared/pagination/cursor';

const paidAt = sql`date_trunc('milliseconds', ${payment.paidAt})`;
const settledAt = sql`date_trunc('milliseconds', ${settlement.settledAt})`;

const paymentsAfter = (after: Cursor): SQL | undefined =>
  or(
    lt(paidAt, after.date),
    after.rank === 0
      ? and(eq(paidAt, after.date), lt(payment.id, after.id))
      : undefined,
  );

const settlementsAfter = (after: Cursor): SQL | undefined =>
  or(
    lt(settledAt, after.date),
    after.rank === 0
      ? eq(settledAt, after.date)
      : and(eq(settledAt, after.date), lt(settlement.id, after.id)),
  );

@Injectable()
export class FeedRepositoryDrizzle implements FeedRepository {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  async findPage(
    groupId: number,
    after: Cursor | null,
    size: number,
  ): Promise<FeedItem[]> {
    const [payments, settlements] = await Promise.all([
      this.database
        .select()
        .from(payment)
        .where(
          and(
            eq(payment.groupId, groupId),
            after ? paymentsAfter(after) : undefined,
          ),
        )
        .orderBy(desc(paidAt), desc(payment.id))
        .limit(size),
      this.database
        .select()
        .from(settlement)
        .where(
          and(
            eq(settlement.groupId, groupId),
            after ? settlementsAfter(after) : undefined,
          ),
        )
        .orderBy(desc(settledAt), desc(settlement.id))
        .limit(size),
    ]);

    return [
      ...payments.map((row) => ({
        kind: 'payment' as const,
        payment: toPayment(row),
      })),
      ...settlements.map((row) => ({
        kind: 'settlement' as const,
        settlement: toSettlement(row),
      })),
    ]
      .sort(newestFirst)
      .slice(0, size);
  }
}
