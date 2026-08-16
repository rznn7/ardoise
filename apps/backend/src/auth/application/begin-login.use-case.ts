import { Inject, Injectable } from '@nestjs/common';
import { LoginState } from 'src/auth/domain/login-state';
import {
  LOGIN_STATE_REPOSITORY,
  type LoginStateRepository,
} from 'src/auth/domain/login-state-repository';
import {
  PASSKEY_VERIFIER,
  type PasskeyVerifier,
} from 'src/auth/domain/passkey-verifier';
import {
  TOKEN_GENERATOR,
  type TokenGenerator,
} from 'src/shared/token-generator/token-generator';

@Injectable()
export class BeginLoginUseCase {
  constructor(
    @Inject(PASSKEY_VERIFIER) private readonly verifier: PasskeyVerifier,
    @Inject(LOGIN_STATE_REPOSITORY)
    private readonly loginStates: LoginStateRepository,
    @Inject(TOKEN_GENERATOR) private readonly tokenGenerator: TokenGenerator,
  ) {}

  async execute(): Promise<{ options: unknown; stateId: string }> {
    const authOpts = await this.verifier.generateAuthenticationOptions();

    const stateId = this.tokenGenerator.generate();
    const state = LoginState.create(stateId, authOpts.challenge, new Date());
    await this.loginStates.save(state);

    return { options: authOpts.raw, stateId };
  }
}
