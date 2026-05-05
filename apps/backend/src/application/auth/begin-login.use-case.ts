import { Inject, Injectable } from '@nestjs/common';
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
    options: unknown;
    loginState: { challenge: string };
  }> {
    const authOpts = await this.verifier.generateAuthenticationOptions();
    return {
      loginState: { challenge: authOpts.challenge },
      options: authOpts.raw,
    };
  }
}
