import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type Settlement } from 'src/settlement/domain/settlement';
import { SettlementRepository } from 'src/settlement/domain/settlement-repository';
import {
  type Database,
  DATABASE_CONNECTION,
} from 'src/shared/database/database.module';
import { settlement } from 'src/shared/database/schema';

@Injectable()
export class SettlementRepositoryDrizzle implements SettlementRepository {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  async findById(id: number): Promise<Settlement | null> {
    const [row] = await this.database
      .select()
      .from(settlement)
      .where(eq(settlement.id, id));

    return row ? toSettlement(row) : null;
  }

  async create(
    input: Omit<Settlement, 'id' | 'createdAt'>,
  ): Promise<Settlement> {
    const [row] = await this.database
      .insert(settlement)
      .values(input)
      .returning();

    if (!row) throw new Error('Settlement insert returned no row');
    return toSettlement(row);
  }

  async delete(id: number): Promise<void> {
    await this.database.delete(settlement).where(eq(settlement.id, id));
  }
}

export const toSettlement = (
  row: typeof settlement.$inferSelect,
): Settlement => ({
  id: row.id,
  groupId: row.groupId,
  fromMemberId: row.fromMemberId,
  toMemberId: row.toMemberId,
  amount: row.amount,
  settledAt: row.settledAt,
  createdByMemberId: row.createdByMemberId,
  createdAt: row.createdAt,
});
