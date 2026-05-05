import { Inject, Injectable } from '@nestjs/common';
import { type PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/server';
import {
  PASSKEY_VERIFIER,
  type PasskeyVerifier,
} from 'src/domain/auth/passkey-verifier';

@Injectable()
export class BeginLoginUseCase {
  constructor(
    @Inject(PASSKEY_VERIFIER) private readonly verifier: PasskeyVerifier,
  ) {}

  async execute(): Promise<{
    options: PublicKeyCredentialRequestOptionsJSON;
    loginState: { challenge: string };
  }> {
    const options = await this.verifier.generateAuthenticationOptions();
    return { options, loginState: { challenge: options.challenge } };
  }
}
