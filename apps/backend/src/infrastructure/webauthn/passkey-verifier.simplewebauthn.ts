import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type PublicKeyCredentialCreationOptionsJSON,
  type RegistrationResponseJSON,
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { type PasskeyVerifier } from 'src/domain/auth/passkey-verifier';

@Injectable()
export class PasskeyVerifierSimpleWebauthn implements PasskeyVerifier {
  constructor(private readonly config: ConfigService) {}

  async generateRegistrationOptions(input: {
    webauthnUserId: string;
  }): Promise<PublicKeyCredentialCreationOptionsJSON> {
    return generateRegistrationOptions({
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
  }

  async verifyRegistration(input: {
    challenge: string;
    attestation: RegistrationResponseJSON;
  }): Promise<{
    credentialId: string;
    publicKey: Uint8Array;
    counter: number;
  }> {
    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response: input.attestation,
      expectedChallenge: input.challenge,
      expectedOrigin: this.config.getOrThrow('EXPECTED_ORIGIN'),
      expectedRPID: this.config.getOrThrow('RP_ID'),
    });

    if (!verified || !registrationInfo)
      throw new Error('passkey registration not verified');

    const { credential } = registrationInfo;
    return {
      credentialId: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
    };
  }
}
