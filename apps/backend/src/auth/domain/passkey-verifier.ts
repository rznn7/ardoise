export const PASSKEY_VERIFIER = Symbol('PASSKEY_VERIFIER');

export interface PasskeyVerifier {
  generateRegistrationOptions(input: {
    webauthnUserId: string;
  }): Promise<RegistrationOptions>;

  verifyRegistration(input: {
    challenge: string;
    attestation: unknown;
  }): Promise<{
    credentialId: string;
    publicKey: Uint8Array;
    counter: number;
  }>;

  generateAuthenticationOptions(): Promise<AuthenticationOptions>;

  verifyAuthentication(input: {
    challenge: string;
    assertion: Assertion;
    credential: { id: string; publicKey: Uint8Array; counter: number };
  }): Promise<{ newCounter: number; userHandle: string }>;
}

export type RegistrationOptions = {
  challenge: string;
  raw: unknown;
};

export type AuthenticationOptions = {
  challenge: string;
  raw: unknown;
};

export type Assertion = {
  credentialId: string;
  raw: unknown;
};
