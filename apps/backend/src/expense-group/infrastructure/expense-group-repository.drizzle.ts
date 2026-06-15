import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { type ExpenseGroup } from 'src/expense-group/domain/expense-group';
import { ExpenseGroupRepository } from 'src/expense-group/domain/expense-group-repository';
import {
  type Database,
  DATABASE_CONNECTION,
} from 'src/shared/database/database.module';
import { expenseGroup, member } from 'src/shared/database/schema';

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

  async findByUserId(userId: number): Promise<ExpenseGroup[]> {
    const rows = await this.database
      .select()
      .from(expenseGroup)
      .innerJoin(member, eq(member.groupId, expenseGroup.id))
      .where(eq(member.userId, userId))
      .orderBy(asc(expenseGroup.id));

    return rows.map((row) => this.toDomain(row.expense_group));
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
