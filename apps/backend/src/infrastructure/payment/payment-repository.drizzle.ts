import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type Payment } from 'src/domain/payment/payment';
import { PaymentRepository } from 'src/domain/payment/payment-repository';
import {
  DATABASE_CONNECTION,
  type Database,
} from '../database/database.module';
import { payment } from '../database/schema';

@Injectable()
export class PaymentRepositoryDrizzle implements PaymentRepository {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  async findById(id: number): Promise<Payment | null> {
    const row = await this.database.query.payment.findFirst({
      where: eq(payment.id, id),
    });

    return row ? this.toDomain(row) : null;
  }

  private toDomain(row: typeof payment.$inferSelect): Payment {
    return {
      id: row.id,
      payerMemberId: row.payerMemberId,
      expenseGroupId: row.expenseGroupId,
      title: row.title,
      paidAt: row.paidAt,
      fullAmount: row.fullAmount,
      splitType: row.splitType,
      createdAt: row.createdAt,
    };
  }
}
