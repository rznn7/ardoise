export type Session = {
  readonly token: string;
  readonly userId: number;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
};

export const Session = {
  issue: (
    token: string,
    userId: number,
    now: Date,
    ttlMs: number,
  ): Session => ({
    token,
    userId,
    issuedAt: now,
    expiresAt: new Date(now.getTime() + ttlMs),
    revokedAt: null,
  }),

  isValid: (session: Session, now: Date): boolean =>
    session.issuedAt < now &&
    now < session.expiresAt &&
    session.revokedAt === null,

  revoke: (session: Session, now: Date): Session => ({
    ...session,
    revokedAt: now,
  }),
};
