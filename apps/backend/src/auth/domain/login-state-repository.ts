import { type LoginState } from './login-state';

export const LOGIN_STATE_REPOSITORY = Symbol('LOGIN_STATE_REPOSITORY');

export interface LoginStateRepository {
  save(state: LoginState): Promise<void>;
  findByStateId(stateId: string): Promise<LoginState | null>;
  delete(stateId: string): Promise<void>;
}
