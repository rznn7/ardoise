import { z } from 'zod';

export const registrationStateSchema = z.object({
  challenge: z.string(),
  webauthnUserId: z.string(),
  inviteToken: z.string(),
});
export type RegistrationState = z.infer<typeof registrationStateSchema>;

export const beginRegistrationRequestSchema = z.object({
  inviteToken: z.string().min(1),
});
export type BeginRegistrationRequest = z.infer<
  typeof beginRegistrationRequestSchema
>;

export const completeRegistrationRequestSchema = z.object({
  registrationState: registrationStateSchema,
  attestation: z.unknown(),
});
export type CompleteRegistrationRequest = z.infer<
  typeof completeRegistrationRequestSchema
>;

export const beginRegistrationResponseSchema = z.object({
  options: z.unknown(),
  registrationState: registrationStateSchema,
});
export type BeginRegistrationResponse = z.infer<
  typeof beginRegistrationResponseSchema
>;
