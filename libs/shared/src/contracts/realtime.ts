import { z } from 'zod';

import { paymentResponseSchema } from './payment.js';
import { settlementResponseSchema } from './settlement.js';

export const OP_ID_HEADER = 'x-op-id';

const opId = z.string().nullable();

const groupEventSchemas = [
  z.object({
    type: z.literal('payment.saved'),
    groupId: z.number(),
    opId,
    payment: paymentResponseSchema,
  }),
  z.object({
    type: z.literal('payment.deleted'),
    groupId: z.number(),
    opId,
    id: z.number(),
  }),
  z.object({
    type: z.literal('settlement.saved'),
    groupId: z.number(),
    opId,
    settlement: settlementResponseSchema,
  }),
  z.object({
    type: z.literal('settlement.deleted'),
    groupId: z.number(),
    opId,
    id: z.number(),
  }),
  z.object({
    type: z.literal('member.joined'),
    groupId: z.number(),
    userId: z.number(),
  }),
  z.object({
    type: z.literal('group.created'),
    groupId: z.number(),
  }),
] as const;

export const groupEventSchema = z.discriminatedUnion('type', groupEventSchemas);

export const realtimeMessageSchema = z.discriminatedUnion('type', [
  ...groupEventSchemas,
  z.object({ type: z.literal('ready') }),
  z.object({ type: z.literal('reset') }),
]);

export type RealtimeMessage = z.infer<typeof realtimeMessageSchema>;
export type GroupEvent = z.infer<typeof groupEventSchema>;
export type RealtimeEventType = RealtimeMessage['type'];
