import { z } from 'zod';

import { type Endpoint } from './http.js';

export const paymentResponseSchema = z.object({
  id: z.number(),
  payerMemberId: z.number(),
  groupId: z.number(),
  title: z.string(),
  paidAt: z.string(),
  fullAmount: z.number(),
  splitType: z.enum(['equal', 'percent', 'shares', 'exact']),
  createdAt: z.string(),
});
export type PaymentResponse = z.infer<typeof paymentResponseSchema>;

export const paymentApi = {
  findOne: {
    method: 'GET',
    path: '/payments/:id',
    res: paymentResponseSchema,
  },
} as const satisfies Record<string, Endpoint>;
