export {};

declare module 'express' {
  interface Request {
    user?: { id: number; name: string; role: 'user' | 'admin' };
  }
}
