import { z } from 'zod';

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
