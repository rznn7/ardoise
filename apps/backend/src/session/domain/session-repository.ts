import { type Session } from './session';

export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');

export interface SessionRepository {
  findByToken(token: string): Promise<Session | null>;
  save(session: Session): Promise<void>;
}
