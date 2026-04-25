import { ExpenseGroup } from './expense-group';

export const EXPENSE_GROUP_REPOSITORY = Symbol('EXPENSE_GROUP_REPOSITORY');

export interface ExpenseGroupRepository {
  findById(id: number): Promise<ExpenseGroup | null>;
}
