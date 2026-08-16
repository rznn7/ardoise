import { meResponseSchema } from './auth.js';
import { type Endpoint } from './http.js';

export const userApi = {
  findOne: {
    method: 'GET',
    path: '/users/:id',
    res: meResponseSchema,
  },
} as const satisfies Record<string, Endpoint>;
