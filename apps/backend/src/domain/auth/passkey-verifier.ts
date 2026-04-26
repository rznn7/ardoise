import type {
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';

export const PASSKEY_VERIFIER = Symbol('PASSKEY_VERIFIER');

export interface PasskeyVerifier {
  generateRegistrationOptions(input: {
    webauthnUserId: string;
  }): Promise<PublicKeyCredentialCreationOptionsJSON>;

  verifyRegistration(input: {
    challenge: string;
    attestation: RegistrationResponseJSON;
  }): Promise<{
    credentialId: string;
    publicKey: Uint8Array;
    counter: number;
  }>;
}
