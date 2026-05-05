import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/server';

export const PASSKEY_VERIFIER = Symbol('PASSKEY_VERIFIER');

export interface PasskeyVerifier {
  generateRegistrationOptions(input: {
    webauthnUserId: string;
  }): Promise<PublicKeyCredentialCreationOptionsJSON>;

  verifyRegistration(input: {
    challenge: string;
    attestation: unknown;
  }): Promise<{
    credentialId: string;
    publicKey: Uint8Array;
    counter: number;
  }>;

  generateAuthenticationOptions(): Promise<PublicKeyCredentialRequestOptionsJSON>;

  verifyAuthentication(input: {
    challenge: string;
    assertion: unknown;
    credential: { id: string; publicKey: Uint8Array; counter: number };
  }): Promise<{ newCounter: number; userHandle: string }>;
}
