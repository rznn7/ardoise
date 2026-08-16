import { z } from 'zod';

import { type Endpoint } from './http.js';

export const paymentShareResponseSchema = z.object({
  paymentId: z.number(),
  memberId: z.number(),
  inputValue: z.number(),
  amount: z.number(),
});
export type PaymentShareResponse = z.infer<typeof paymentShareResponseSchema>;

export const paymentShareApi = {
  findByPayment: {
    method: 'GET',
    path: '/payment-shares/by-payment/:paymentId',
    res: z.array(paymentShareResponseSchema),
  },
} as const satisfies Record<string, Endpoint>;
