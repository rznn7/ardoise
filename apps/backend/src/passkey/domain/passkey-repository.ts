import { type Passkey } from './passkey';

export const PASSKEY_REPOSITORY = Symbol('PASSKEY_REPOSITORY');

export interface PasskeyRepository {
  findByCredentialId(id: string): Promise<Passkey | null>;
  findByUserId(id: number): Promise<Passkey | null>;
  create(input: {
    userId: number;
    credentialId: string;
    publicKey: Uint8Array;
    counter: number;
  }): Promise<Passkey>;
  markUsed(id: number, counter: number): Promise<void>;
}
