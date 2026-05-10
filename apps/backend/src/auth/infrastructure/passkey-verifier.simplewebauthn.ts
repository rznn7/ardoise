import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type AuthenticationResponseJSON,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type RegistrationResponseJSON,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import {
  type Assertion,
  type AuthenticationOptions,
  type PasskeyVerifier,
  type RegistrationOptions,
} from 'src/auth/domain/passkey-verifier';

@Injectable()
export class PasskeyVerifierSimpleWebauthn implements PasskeyVerifier {
  constructor(private readonly config: ConfigService) {}

  async generateRegistrationOptions(input: {
    webauthnUserId: string;
  }): Promise<RegistrationOptions> {
    const opts = await generateRegistrationOptions({
      rpName: this.config.getOrThrow('RP_NAME'),
      rpID: this.config.getOrThrow('RP_ID'),
      userID: new TextEncoder().encode(input.webauthnUserId),
      userName: 'pending',
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
      attestationType: 'none',
    });

    return {
      challenge: opts.challenge,
      raw: opts,
    };
  }

  async verifyRegistration(input: {
    challenge: string;
    attestation: unknown;
  }): Promise<{
    credentialId: string;
    publicKey: Uint8Array;
    counter: number;
  }> {
    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response: input.attestation as RegistrationResponseJSON,
      expectedChallenge: input.challenge,
      expectedOrigin: this.config.getOrThrow('EXPECTED_ORIGIN'),
      expectedRPID: this.config.getOrThrow('RP_ID'),
    });

    if (!verified) throw new Error('passkey registration not verified');

    const { credential } = registrationInfo;
    return {
      credentialId: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
    };
  }

  async generateAuthenticationOptions(): Promise<AuthenticationOptions> {
    const authOpts = await generateAuthenticationOptions({
      rpID: this.config.getOrThrow('RP_ID'),
      allowCredentials: [],
      userVerification: 'required',
    });

    return {
      challenge: authOpts.challenge,
      raw: authOpts,
    };
  }

  async verifyAuthentication(input: {
    challenge: string;
    assertion: Assertion;
    credential: { id: string; publicKey: Uint8Array; counter: number };
  }): Promise<{ newCounter: number; userHandle: string }> {
    const rawAssertion = input.assertion.raw as AuthenticationResponseJSON;

    if (!rawAssertion.response.userHandle)
      throw new Error('missing userHandle');
    const userHandle = new TextDecoder().decode(
      isoBase64URL.toBuffer(rawAssertion.response.userHandle),
    );

    const { verified, authenticationInfo } = await verifyAuthenticationResponse(
      {
        response: rawAssertion,
        credential: {
          ...input.credential,
          publicKey: new Uint8Array(input.credential.publicKey),
        },
        expectedChallenge: input.challenge,
        expectedOrigin: this.config.getOrThrow('EXPECTED_ORIGIN'),
        expectedRPID: this.config.getOrThrow('RP_ID'),
        requireUserVerification: true,
      },
    );

    if (!verified) throw new Error('passkey authentication not verified');

    if (
      input.credential.counter > 0 &&
      authenticationInfo.newCounter <= input.credential.counter
    )
      throw new Error('passkey counter regression');

    return { newCounter: authenticationInfo.newCounter, userHandle };
  }
}
