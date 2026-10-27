import { z } from 'zod';

import { type Endpoint } from './http.js';
import { pageQuerySchema, pageSchema } from './page.js';
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

export const feedPageSchema = pageSchema(feedItemSchema);
export type FeedPage = z.infer<typeof feedPageSchema>;

export const feedApi = {
  listByGroup: {
    method: 'GET',
    path: '/expense-groups/:groupId/feed',
    query: pageQuerySchema,
    res: feedPageSchema,
  },
} as const satisfies Record<string, Endpoint>;
