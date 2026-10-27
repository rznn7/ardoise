import { z } from 'zod';

import { type Endpoint } from './http.js';
import { pageQuerySchema, pageSchema } from './page.js';

const INT4_MAX = 2_147_483_647;

export const settlementResponseSchema = z.object({
  id: z.number(),
  groupId: z.number(),
  fromMemberId: z.number(),
  toMemberId: z.number(),
  amount: z.number().int(),
  settledAt: z.string(),
  createdByMemberId: z.number(),
  createdAt: z.string(),
});
export type SettlementResponse = z.infer<typeof settlementResponseSchema>;

export const settlementPageSchema = pageSchema(settlementResponseSchema);
export type SettlementPage = z.infer<typeof settlementPageSchema>;

export const createSettlementRequestSchema = z
  .object({
    groupId: z.number().int(),
    fromMemberId: z.number().int(),
    toMemberId: z.number().int(),
    amount: z.number().int().positive().max(INT4_MAX),
  })
  .strict();
export type CreateSettlementRequest = z.infer<
  typeof createSettlementRequestSchema
>;
export type CreateSettlementBody = z.input<
  typeof createSettlementRequestSchema
>;

export const settlementErrorSchema = z.object({
  error: z.enum([
    'INVALID_SETTLEMENT',
    'SETTLEMENT_MEMBER_NOT_IN_GROUP',
    'NOT_INVOLVED_IN_SETTLEMENT',
    'SETTLEMENT_NOT_FOUND',
  ]),
});
export type SettlementError = z.infer<typeof settlementErrorSchema>;

export const settlementApi = {
  listByGroup: {
    method: 'GET',
    path: '/expense-groups/:groupId/settlements',
    query: pageQuerySchema,
    res: settlementPageSchema,
  },
  findOne: {
    method: 'GET',
    path: '/settlements/:id',
    res: settlementResponseSchema,
  },
  create: {
    method: 'POST',
    path: '/settlements',
    body: createSettlementRequestSchema,
    res: settlementResponseSchema,
  },
  delete: {
    method: 'DELETE',
    path: '/settlements/:id',
    status: 204,
  },
} as const satisfies Record<string, Endpoint>;
