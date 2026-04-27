import { type Session } from './session';

export interface SessionRepository {
  findByToken(token: string): Promise<Session | null>;
  save(session: Session): Promise<void>;
}
