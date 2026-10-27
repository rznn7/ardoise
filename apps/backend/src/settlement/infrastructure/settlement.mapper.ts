import { type SettlementResponse } from '@ardoise/shared';
import { type Settlement } from 'src/settlement/domain/settlement';

export const toSettlementResponse = (
  settlement: Settlement,
): SettlementResponse => ({
  id: settlement.id,
  groupId: settlement.groupId,
  fromMemberId: settlement.fromMemberId,
  toMemberId: settlement.toMemberId,
  amount: settlement.amount,
  settledAt: settlement.settledAt.toISOString(),
  createdByMemberId: settlement.createdByMemberId,
  createdAt: settlement.createdAt.toISOString(),
});
