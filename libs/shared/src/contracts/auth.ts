import { z } from 'zod';

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
