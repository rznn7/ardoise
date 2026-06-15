import { z } from 'zod';

export const memberResponseSchema = z.object({
  id: z.number(),
  userId: z.number(),
  groupId: z.number(),
  nickname: z.string().nullable(),
  isModerator: z.boolean(),
});
export type MemberResponse = z.infer<typeof memberResponseSchema>;
