import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type PaymentShare } from 'src/payment-share/domain/payment-share';
import { PaymentShareRepository } from 'src/payment-share/domain/payment-share-repository';
import {
  type Database,
  DATABASE_CONNECTION,
} from 'src/shared/database/database.module';
import { paymentShare } from 'src/shared/database/schema';

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
