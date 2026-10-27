import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type FeedItem, newestFirst } from 'src/feed/domain/feed';
import { FeedRepository } from 'src/feed/domain/feed-repository';
import { toPayment } from 'src/payment/infrastructure/payment-repository.drizzle';
import { toSettlement } from 'src/settlement/infrastructure/settlement-repository.drizzle';
import {
  type Database,
  DATABASE_CONNECTION,
} from 'src/shared/database/database.module';
import { payment, settlement } from 'src/shared/database/schema';

@Injectable()
export class FeedRepositoryDrizzle implements FeedRepository {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  async findByGroupId(groupId: number): Promise<FeedItem[]> {
    const [payments, settlements] = await Promise.all([
      this.database.select().from(payment).where(eq(payment.groupId, groupId)),
      this.database
        .select()
        .from(settlement)
        .where(eq(settlement.groupId, groupId)),
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
    ].sort(newestFirst);
  }
}
