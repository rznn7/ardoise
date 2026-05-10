import { Inject, Injectable } from '@nestjs/common';
import {
  type Assertion,
  PASSKEY_VERIFIER,
  type PasskeyVerifier,
} from 'src/auth/domain/passkey-verifier';
import { Session, SESSION_TTL_MS, UserHandleMismatch } from 'src/auth/domain/session';
import { PasskeyNotFound } from 'src/passkey/domain/passkey';
import {
  TOKEN_GENERATOR,
  type TokenGenerator,
} from 'src/auth/domain/token-generator';
import { UNIT_OF_WORK, type UnitOfWork } from 'src/auth/domain/unit-of-work';

@Injectable()
export class CompleteLoginUseCase {
  constructor(
    @Inject(PASSKEY_VERIFIER) private readonly verifier: PasskeyVerifier,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(TOKEN_GENERATOR) private readonly tokenGenerator: TokenGenerator,
  ) {}

  async execute(input: {
    loginState: { challenge: string };
    assertion: Assertion;
  }): Promise<{ token: string }> {
    return this.uow.run(async (repos) => {
      const passkey = await repos.passkeys.findByCredentialId(
        input.assertion.credentialId,
      );

      if (!passkey) throw new PasskeyNotFound();

      const { newCounter, userHandle } =
        await this.verifier.verifyAuthentication({
          challenge: input.loginState.challenge,
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
