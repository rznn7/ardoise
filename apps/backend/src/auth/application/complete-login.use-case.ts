import { Inject, Injectable } from '@nestjs/common';
import {
  LoginState,
  LoginStateExpired,
  LoginStateNotFound,
} from 'src/auth/domain/login-state';
import {
  LOGIN_STATE_REPOSITORY,
  type LoginStateRepository,
} from 'src/auth/domain/login-state-repository';
import {
  type Assertion,
  PASSKEY_VERIFIER,
  type PasskeyVerifier,
} from 'src/auth/domain/passkey-verifier';
import { UNIT_OF_WORK, type UnitOfWork } from 'src/auth/domain/unit-of-work';
import { PasskeyNotFound } from 'src/passkey/domain/passkey';
import {
  Session,
  SESSION_TTL_MS,
  UserHandleMismatch,
} from 'src/session/domain/session';
import {
  TOKEN_GENERATOR,
  type TokenGenerator,
} from 'src/shared/token-generator/token-generator';

@Injectable()
export class CompleteLoginUseCase {
  constructor(
    @Inject(PASSKEY_VERIFIER) private readonly verifier: PasskeyVerifier,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(TOKEN_GENERATOR) private readonly tokenGenerator: TokenGenerator,
    @Inject(LOGIN_STATE_REPOSITORY)
    private readonly loginStates: LoginStateRepository,
  ) {}

  async execute(input: {
    stateId: string;
    assertion: Assertion;
  }): Promise<{ token: string }> {
    const state = await this.loginStates.findByStateId(input.stateId);
    if (!state) throw new LoginStateNotFound();
    if (!LoginState.isValid(state, new Date())) throw new LoginStateExpired();

    await this.loginStates.delete(input.stateId);

    return this.uow.run(async (repos) => {
      const passkey = await repos.passkeys.findByCredentialId(
        input.assertion.credentialId,
      );

      if (!passkey) throw new PasskeyNotFound();

      const { newCounter, userHandle } =
        await this.verifier.verifyAuthentication({
          challenge: state.challenge,
          assertion: input.assertion,
          credential: {
            id: passkey.credentialId,
            publicKey: passkey.publicKey,
            counter: passkey.counter,
          },
        });

      const user = await repos.users.findByWebauthnUserId(userHandle);

      if (user?.id !== passkey.userId) throw new UserHandleMismatch();

      await repos.passkeys.markUsed(passkey.id, newCounter);

      const now = new Date();
      const token = this.tokenGenerator.generate();
      const session = Session.issue(token, passkey.userId, now, SESSION_TTL_MS);
      await repos.sessions.save(session);

      return { token };
    });
  }
}
