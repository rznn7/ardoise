import { z } from 'zod';

import { meResponseSchema } from './auth.js';
import { type Endpoint } from './http.js';

export const USER_NAME_MAX_LENGTH = 50;

export const userNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(USER_NAME_MAX_LENGTH);

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
