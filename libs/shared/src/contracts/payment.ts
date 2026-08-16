import { z } from 'zod';

import { type Endpoint } from './http.js';
import { paymentShareResponseSchema } from './payment-share.js';

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

const INT4_MAX = 2_147_483_647;
const MAX_PARTICIPANTS = 100;

export const paymentParticipantSchema = z
  .object({
    memberId: z.number().int(),
    inputValue: z.number().int().min(0).max(INT4_MAX).default(0),
  })
  .strict();

export const createPaymentRequestSchema = z
  .object({
    groupId: z.number().int(),
    payerMemberId: z.number().int(),
    title: z.string().min(1).max(255),
    paidAt: z.iso.datetime().transform((s) => new Date(s)),
    fullAmount: z.number().int().positive().max(INT4_MAX),
    splitType: z.enum(['equal', 'percent', 'shares', 'exact']),
    participants: z
      .array(paymentParticipantSchema)
      .min(1)
      .max(MAX_PARTICIPANTS),
  })
  .strict();
export type CreatePaymentRequest = z.infer<typeof createPaymentRequestSchema>;

export const createPaymentResponseSchema = z.object({
  payment: paymentResponseSchema,
  shares: z.array(paymentShareResponseSchema),
});
export type CreatePaymentResponse = z.infer<typeof createPaymentResponseSchema>;

export const createPaymentErrorSchema = z.object({
  error: z.enum([
    'PAYER_NOT_IN_GROUP',
    'PARTICIPANT_NOT_IN_GROUP',
    'EMPTY_PARTICIPANTS',
    'NON_POSITIVE_AMOUNT',
    'NON_INTEGER_VALUE',
    'DUPLICATE_PARTICIPANT',
    'NEGATIVE_INPUT_VALUE',
    'PERCENT_TOTAL_MISMATCH',
    'EXACT_TOTAL_MISMATCH',
    'ZERO_TOTAL_WEIGHT',
    'SHARE_WEIGHT_TOO_LARGE',
  ]),
});
export type CreatePaymentError = z.infer<typeof createPaymentErrorSchema>;

export const paymentApi = {
  findOne: {
    method: 'GET',
    path: '/payments/:id',
    res: paymentResponseSchema,
  },
  create: {
    method: 'POST',
    path: '/payments',
    body: createPaymentRequestSchema,
    res: createPaymentResponseSchema,
  },
} as const satisfies Record<string, Endpoint>;
