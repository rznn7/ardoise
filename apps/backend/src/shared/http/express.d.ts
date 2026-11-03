export type SessionUser = { id: number; name: string; role: 'user' | 'admin' };
export type AuthSession = { id: number; expiresAt: Date };

declare module 'express' {
  interface Request {
    user?: SessionUser;
    authSession?: AuthSession;
  }
}
