import { type ExpenseGroupSummary } from '@ardoise/shared';
import { type ExpenseGroup } from 'src/expense-group/domain/expense-group';

export const toExpenseGroupSummary = (
  group: ExpenseGroup,
): ExpenseGroupSummary => ({
  id: group.id,
  name: group.name,
  currencyCode: group.currencyCode,
  createdAt: group.createdAt.toISOString(),
});
