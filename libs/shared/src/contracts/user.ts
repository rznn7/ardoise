import { z } from 'zod';

import { meResponseSchema } from './auth.js';
import { type Endpoint } from './http.js';
import { userNameSchema } from './user-name.js';

export const renameUserRequestSchema = z.object({ name: userNameSchema });
export type RenameUserRequest = z.infer<typeof renameUserRequestSchema>;

export const userApi = {
  renameMe: {
    method: 'PATCH',
    path: '/users/me',
    status: 200,
    body: renameUserRequestSchema,
    res: meResponseSchema,
  },
} as const satisfies Record<string, Endpoint>;
