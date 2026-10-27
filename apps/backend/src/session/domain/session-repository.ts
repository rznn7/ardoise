import { type Session, type StoredSession } from './session';

export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');

export interface SessionRepository {
  findById(id: number): Promise<StoredSession | null>;
  findByToken(token: string): Promise<StoredSession | null>;
  save(session: Session): Promise<void>;
}
