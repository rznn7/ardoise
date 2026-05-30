import { type RegistrationState } from './registration-state';

export const REGISTRATION_STATE_REPOSITORY = Symbol(
  'REGISTRATION_STATE_REPOSITORY',
);

export interface RegistrationStateRepository {
  save(state: RegistrationState): Promise<void>;
  findByStateId(stateId: string): Promise<RegistrationState | null>;
  delete(stateId: string): Promise<void>;
}
