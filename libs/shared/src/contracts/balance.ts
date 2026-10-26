import { z } from 'zod';

import { type Endpoint } from './http.js';

export const memberBalanceSchema = z.object({
  memberId: z.number(),
  amount: z.number().int(),
});
export type MemberBalanceResponse = z.infer<typeof memberBalanceSchema>;

export const transferSchema = z.object({
  fromMemberId: z.number(),
  toMemberId: z.number(),
  amount: z.number().int(),
});
export type TransferResponse = z.infer<typeof transferSchema>;

export const groupBalancesResponseSchema = z.object({
  balances: z.array(memberBalanceSchema),
  transfers: z.array(transferSchema),
});
export type GroupBalancesResponse = z.infer<typeof groupBalancesResponseSchema>;

export const myBalanceSchema = z.object({
  groupId: z.number(),
  amount: z.number().int(),
});
export type MyBalance = z.infer<typeof myBalanceSchema>;

export const balanceApi = {
  listByGroup: {
    method: 'GET',
    path: '/expense-groups/:groupId/balances',
    res: groupBalancesResponseSchema,
  },
} as const satisfies Record<string, Endpoint>;
