export type LoginState = {
  readonly stateId: string;
  readonly challenge: string;
  readonly expiresAt: Date;
};

export const LOGIN_STATE_TTL_MS = 10 * 60 * 1000;

export const LoginState = {
  create: (stateId: string, challenge: string, now: Date): LoginState => ({
    stateId,
    challenge,
    expiresAt: new Date(now.getTime() + LOGIN_STATE_TTL_MS),
  }),

  isValid: (state: LoginState, now: Date): boolean => now < state.expiresAt,
};

export class LoginStateNotFound extends Error {}
export class LoginStateExpired extends Error {}
