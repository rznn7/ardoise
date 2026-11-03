import { type Payment } from 'src/payment/domain/payment';
import { type Settlement } from 'src/settlement/domain/settlement';

export type GroupChange = (
  | { type: 'payment.saved'; payment: Payment }
  | { type: 'payment.deleted'; groupId: number; id: number }
  | { type: 'settlement.saved'; settlement: Settlement }
  | { type: 'settlement.deleted'; groupId: number; id: number }
  | { type: 'member.joined'; groupId: number; userId: number }
  | { type: 'group.created'; groupId: number; userId: number }
) & { opId?: string };
