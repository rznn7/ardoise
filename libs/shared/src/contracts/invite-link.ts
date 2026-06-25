import { z } from 'zod';

import { type Endpoint } from './http.js';

export const createInviteLinkRequestSchema = z.object({
  groupId: z.number(),
  expiresAt: z.iso.datetime().transform((s) => new Date(s)),
  singleUse: z.boolean(),
});
export type CreateInviteLinkRequest = z.infer<
  typeof createInviteLinkRequestSchema
>;

export const createInviteLinkResponseSchema = z.object({ token: z.string() });
export type CreateInviteLinkResponse = z.infer<
  typeof createInviteLinkResponseSchema
>;

export const consumeInviteLinkRequestSchema = z
  .object({ token: z.string().min(1).max(64) })
  .strict();
export type ConsumeInviteLinkRequest = z.infer<
  typeof consumeInviteLinkRequestSchema
>;

export const consumeInviteLinkResponseSchema = z.object({
  groupId: z.number(),
  alreadyMember: z.boolean(),
});
export type ConsumeInviteLinkResponse = z.infer<
  typeof consumeInviteLinkResponseSchema
>;

export const consumeInviteLinkErrorSchema = z.object({
  error: z.enum(['INVITE_NOT_FOUND', 'INVITE_EXPIRED', 'INVITE_CONSUMED']),
});
export type ConsumeInviteLinkError = z.infer<
  typeof consumeInviteLinkErrorSchema
>;

export const inviteLinkApi = {
  create: {
    method: 'POST',
    path: '/invite-link',
    body: createInviteLinkRequestSchema,
    res: createInviteLinkResponseSchema,
  },
  consume: {
    method: 'POST',
    path: '/invite-link/consume',
    status: 200,
    body: consumeInviteLinkRequestSchema,
    res: consumeInviteLinkResponseSchema,
  },
} as const satisfies Record<string, Endpoint>;
