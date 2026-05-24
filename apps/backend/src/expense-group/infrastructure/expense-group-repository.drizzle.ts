import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type ExpenseGroup } from 'src/expense-group/domain/expense-group';
import { ExpenseGroupRepository } from 'src/expense-group/domain/expense-group-repository';
import {
  type Database,
  DATABASE_CONNECTION,
} from 'src/shared/database/database.module';
import { expenseGroup } from 'src/shared/database/schema';

@Injectable()
export class ExpenseGroupRepositoryDrizzle implements ExpenseGroupRepository {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  async findById(id: number): Promise<ExpenseGroup | null> {
    const row = await this.database.query.expenseGroup.findFirst({
      where: eq(expenseGroup.id, id),
    });

    return row ? this.toDomain(row) : null;
  }

  async create(input: {
    name: string;
    currencyCode: string;
  }): Promise<ExpenseGroup> {
    const [row] = await this.database
      .insert(expenseGroup)
      .values(input)
      .returning();

    if (!row) throw new Error('ExpenseGroup insert returned no row');
    return this.toDomain(row);
  }

  private toDomain(row: typeof expenseGroup.$inferSelect): ExpenseGroup {
    return {
      id: row.id,
      name: row.name,
      currencyCode: row.currencyCode,
      createdAt: row.createdAt,
    };
  }
}
