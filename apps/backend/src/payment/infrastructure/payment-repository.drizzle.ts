import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { type Payment } from 'src/payment/domain/payment';
import { PaymentRepository } from 'src/payment/domain/payment-repository';
import {
  type Database,
  DATABASE_CONNECTION,
} from 'src/shared/database/database.module';
import { payment } from 'src/shared/database/schema';

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

  async findByGroupId(groupId: number): Promise<Payment[]> {
    const rows = await this.database
      .select()
      .from(payment)
      .where(eq(payment.groupId, groupId))
      .orderBy(desc(payment.paidAt), desc(payment.id));

    return rows.map((row) => this.toDomain(row));
  }

  async create(input: Omit<Payment, 'id' | 'createdAt'>): Promise<Payment> {
    const [row] = await this.database.insert(payment).values(input).returning();

    if (!row) throw new Error('Payment insert returned no row');
    return this.toDomain(row);
  }

  async update(
    id: number,
    fields: Omit<Payment, 'id' | 'groupId' | 'createdAt'>,
  ): Promise<Payment> {
    const [row] = await this.database
      .update(payment)
      .set(fields)
      .where(eq(payment.id, id))
      .returning();

    if (!row) throw new Error('Payment update returned no row');
    return this.toDomain(row);
  }

  async delete(id: number): Promise<void> {
    await this.database.delete(payment).where(eq(payment.id, id));
  }

  private toDomain(row: typeof payment.$inferSelect): Payment {
    return {
      id: row.id,
      payerMemberId: row.payerMemberId,
      groupId: row.groupId,
      title: row.title,
      paidAt: row.paidAt,
      fullAmount: row.fullAmount,
      splitType: row.splitType,
      createdAt: row.createdAt,
    };
  }
}
