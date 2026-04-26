import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type PaymentShare } from 'src/domain/payment-share/payment-share';
import { PaymentShareRepository } from 'src/domain/payment-share/payment-share-repository';
import {
  DATABASE_CONNECTION,
  type Database,
} from '../database/database.module';
import { paymentShare } from '../database/schema';

@Injectable()
export class PaymentShareRepositoryDrizzle implements PaymentShareRepository {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  async findByPayment(paymentId: number): Promise<PaymentShare[]> {
    const rows = await this.database.query.paymentShare.findMany({
      where: eq(paymentShare.paymentId, paymentId),
    });

    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: typeof paymentShare.$inferSelect): PaymentShare {
    return {
      paymentId: row.paymentId,
      memberId: row.memberId,
      inputValue: row.inputValue,
      amount: row.amount,
    };
  }
}
