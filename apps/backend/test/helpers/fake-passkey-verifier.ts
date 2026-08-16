import { type PasskeyVerifier } from 'src/auth/domain/passkey-verifier';

export const fakePasskeyVerifier: PasskeyVerifier = {
  generateRegistrationOptions: ({ webauthnUserId }) =>
    Promise.resolve({
      challenge: 'test-challenge',
      raw: {
        challenge: 'test-challenge',
        rp: { name: 'test', id: 'localhost' },
        user: { id: webauthnUserId, name: 'x', displayName: 'x' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      },
    }),
  verifyRegistration: () =>
    Promise.resolve({
      credentialId: 'cred-1',
      publicKey: new Uint8Array([1, 2, 3]),
      counter: 0,
    }),
  generateAuthenticationOptions: () =>
    Promise.resolve({
      challenge: 'test-challenge',
      raw: {
        challenge: 'test-challenge',
        rpId: 'localhost',
        allowCredentials: [],
      },
    }),
  verifyAuthentication: () =>
    Promise.resolve({
      newCounter: 1,
      userHandle: 'webauthn-test',
    }),
};
