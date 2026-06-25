import { z } from 'zod';

import { type Endpoint } from './http.js';

export const beginRegistrationRequestSchema = z.object({
  inviteToken: z.string().min(1),
});
export type BeginRegistrationRequest = z.infer<
  typeof beginRegistrationRequestSchema
>;

export const beginRegistrationResponseSchema = z.object({
  options: z.unknown(),
  stateId: z.string(),
});
export type BeginRegistrationResponse = z.infer<
  typeof beginRegistrationResponseSchema
>;

export const completeRegistrationRequestSchema = z.object({
  stateId: z.string(),
  attestation: z.unknown(),
});
export type CompleteRegistrationRequest = z.infer<
  typeof completeRegistrationRequestSchema
>;

export const beginLoginResponseSchema = z.object({
  options: z.unknown(),
  stateId: z.string(),
});
export type BeginLoginResponse = z.infer<typeof beginLoginResponseSchema>;

export const completeLoginRequestSchema = z.object({
  stateId: z.string(),
  assertion: z.object({ id: z.string() }).loose(),
});
export type CompleteLoginRequest = z.infer<typeof completeLoginRequestSchema>;

export const meResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  role: z.enum(['user', 'admin']),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

export const authApi = {
  registerBegin: {
    method: 'POST',
    path: '/auth/register/begin',
    status: 200,
    body: beginRegistrationRequestSchema,
    res: beginRegistrationResponseSchema,
  },
  registerComplete: {
    method: 'POST',
    path: '/auth/register/complete',
    status: 204,
    body: completeRegistrationRequestSchema,
  },
  loginBegin: {
    method: 'POST',
    path: '/auth/login/begin',
    status: 200,
    res: beginLoginResponseSchema,
  },
  loginComplete: {
    method: 'POST',
    path: '/auth/login/complete',
    status: 204,
    body: completeLoginRequestSchema,
  },
  logout: {
    method: 'POST',
    path: '/auth/logout',
    status: 204,
  },
  me: {
    method: 'POST',
    path: '/auth/me',
    status: 200,
    res: meResponseSchema,
  },
} as const satisfies Record<string, Endpoint>;
