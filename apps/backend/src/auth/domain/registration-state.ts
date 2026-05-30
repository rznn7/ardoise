export type RegistrationState = {
  readonly stateId: string;
  readonly challenge: string;
  readonly webauthnUserId: string;
  readonly inviteToken: string;
  readonly expiresAt: Date;
};

export const REGISTRATION_STATE_TTL_MS = 10 * 60 * 1000;

export const RegistrationState = {
  create: (
    stateId: string,
    challenge: string,
    webauthnUserId: string,
    inviteToken: string,
    now: Date,
  ): RegistrationState => ({
    stateId,
    challenge,
    webauthnUserId,
    inviteToken,
    expiresAt: new Date(now.getTime() + REGISTRATION_STATE_TTL_MS),
  }),

  isValid: (state: RegistrationState, now: Date): boolean =>
    now < state.expiresAt,
};

export class RegistrationStateNotFound extends Error {}
export class RegistrationStateExpired extends Error {}
