import { type User } from 'src/user/domain/user';

declare module 'express' {
  interface Request {
    user?: User;
  }
}
