import { type RegistrationState } from '@ardoise/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import {
  PASSKEY_VERIFIER,
  type PasskeyVerifier,
} from 'src/domain/auth/passkey-verifier';
import { UNIT_OF_WORK, type UnitOfWork } from 'src/domain/auth/unit-of-work';

@Injectable()
export class CompleteRegistrationUseCase {
  constructor(
    @Inject(PASSKEY_VERIFIER) private readonly verifier: PasskeyVerifier,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async execute(input: {
    registrationState: RegistrationState;
    attestation: RegistrationResponseJSON;
  }): Promise<void> {
    const { credentialId, publicKey, counter } =
      await this.verifier.verifyRegistration({
        challenge: input.registrationState.challenge,
        attestation: input.attestation,
      });

    await this.uow.run(async (repos) => {
      const invite = await repos.inviteLinks.findUsableByToken(
        input.registrationState.inviteToken,
      );
      if (!invite)
        throw new Error(
          `no invite-link found for token [${input.registrationState.inviteToken}]`,
        );

      const user = await repos.users.create({
        name: `user-${crypto.randomUUID()}`,
        webauthnUserId: input.registrationState.webauthnUserId,
      });
      await repos.passkeys.create({
        userId: user.id,
        credentialId,
        publicKey,
        counter,
      });
      await repos.members.create({
        userId: user.id,
        groupId: invite.groupId,
      });
      await repos.inviteLinks.markConsumed(invite.id, user.id);
    });
  }
}
