export type SessionUser = { id: number; name: string; role: 'user' | 'admin' };

declare module 'express' {
  interface Request {
    user?: SessionUser;
  }
}
