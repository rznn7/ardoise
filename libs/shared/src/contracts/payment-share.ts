import { z } from 'zod';

export const paymentShareResponseSchema = z.object({
  paymentId: z.number(),
  memberId: z.number(),
  inputValue: z.number(),
  amount: z.number(),
});
export type PaymentShareResponse = z.infer<typeof paymentShareResponseSchema>;
