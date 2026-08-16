import { z } from 'zod';

import { groupMemberSchema } from './expense-group.js';
import { type Endpoint } from './http.js';

export const memberResponseSchema = z.object({
  id: z.number(),
  userId: z.number(),
  groupId: z.number(),
  nickname: z.string().nullable(),
  isModerator: z.boolean(),
});
export type MemberResponse = z.infer<typeof memberResponseSchema>;

export const memberApi = {
  findOne: {
    method: 'GET',
    path: '/members/:id',
    res: memberResponseSchema,
  },
  listByGroup: {
    method: 'GET',
    path: '/expense-groups/:groupId/members',
    res: z.array(groupMemberSchema),
  },
} as const satisfies Record<string, Endpoint>;
