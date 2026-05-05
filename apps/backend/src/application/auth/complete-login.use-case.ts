import { Inject, Injectable } from '@nestjs/common';
import { AuthenticationResponseJSON } from '@simplewebauthn/server';
import {
  PASSKEY_VERIFIER,
  type PasskeyVerifier,
} from 'src/domain/auth/passkey-verifier';
import { Session, SESSION_TTL_MS } from 'src/domain/auth/session';
import {
  TOKEN_GENERATOR,
  type TokenGenerator,
} from 'src/domain/auth/token-generator';
import { UNIT_OF_WORK, type UnitOfWork } from 'src/domain/auth/unit-of-work';

@Injectable()
export class CompleteLoginUseCase {
  constructor(
    @Inject(PASSKEY_VERIFIER) private readonly verifier: PasskeyVerifier,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(TOKEN_GENERATOR) private readonly tokenGenerator: TokenGenerator,
  ) {}

  async execute(input: {
    loginState: { challenge: string };
    assertion: unknown;
  }): Promise<{ token: string }> {
    const assertion = input.assertion as AuthenticationResponseJSON;
    return this.uow.run(async (repos) => {
      const passkey = await repos.passkeys.findByCredentialId(assertion.id);

      if (!passkey) throw new Error('no passkey found');

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

      if (user?.id !== passkey.userId) throw new Error('userHandle mismatch');

      await repos.passkeys.markUsed(passkey.id, newCounter);

      const now = new Date();
      const token = this.tokenGenerator.generate();
      const session = Session.issue(token, passkey.userId, now, SESSION_TTL_MS);
      await repos.sessions.save(session);

      return { token };
    });
  }
}
