import { z } from 'zod';

export const createInviteLinkRequestSchema = z.object({
  groupId: z.number(),
  expiresAt: z.iso.datetime().transform((s) => new Date(s)),
  singleUse: z.boolean(),
});
export type CreateInviteLinkRequest = z.infer<
  typeof createInviteLinkRequestSchema
>;
