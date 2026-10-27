import { z } from 'zod';

import { type Endpoint } from './http.js';
import { paymentResponseSchema } from './payment.js';
import { settlementResponseSchema } from './settlement.js';

export const feedItemSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('payment'), payment: paymentResponseSchema }),
  z.object({
    kind: z.literal('settlement'),
    settlement: settlementResponseSchema,
  }),
]);
export type FeedItem = z.infer<typeof feedItemSchema>;

export const feedApi = {
  listByGroup: {
    method: 'GET',
    path: '/expense-groups/:groupId/feed',
    res: z.array(feedItemSchema),
  },
} as const satisfies Record<string, Endpoint>;
