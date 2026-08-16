import { type ExpenseGroup } from './expense-group';

export const EXPENSE_GROUP_REPOSITORY = Symbol('EXPENSE_GROUP_REPOSITORY');

export interface ExpenseGroupRepository {
  findById(id: number): Promise<ExpenseGroup | null>;
  findByUserId(userId: number): Promise<ExpenseGroup[]>;
  create(input: { name: string; currencyCode: string }): Promise<ExpenseGroup>;
}
