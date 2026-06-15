import { z } from 'zod';

export const createExpenseGroupRequestSchema = z.object({
  name: z.string(),
  currencyCode: z.string(),
});
export type CreateExpenseGroupRequest = z.infer<
  typeof createExpenseGroupRequestSchema
>;

export const groupMemberSchema = z.object({
  id: z.number(),
  userId: z.number(),
  nickname: z.string().nullable(),
  isModerator: z.boolean(),
});
export type GroupMember = z.infer<typeof groupMemberSchema>;
