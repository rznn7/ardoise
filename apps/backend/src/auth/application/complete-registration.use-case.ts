import { Inject, Injectable } from '@nestjs/common';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import {
  PASSKEY_VERIFIER,
  type PasskeyVerifier,
} from 'src/auth/domain/passkey-verifier';
import {
  RegistrationState,
  RegistrationStateExpired,
  RegistrationStateNotFound,
} from 'src/auth/domain/registration-state';
import {
  REGISTRATION_STATE_REPOSITORY,
  type RegistrationStateRepository,
} from 'src/auth/domain/registration-state-repository';
import { UNIT_OF_WORK, type UnitOfWork } from 'src/auth/domain/unit-of-work';
import { consumeInviteLink } from 'src/invite-link/domain/consume-invite-link';

@Injectable()
export class CompleteRegistrationUseCase {
  constructor(
    @Inject(PASSKEY_VERIFIER) private readonly verifier: PasskeyVerifier,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(REGISTRATION_STATE_REPOSITORY)
    private readonly registrationStates: RegistrationStateRepository,
  ) {}

  async execute(input: {
    stateId: string;
    attestation: RegistrationResponseJSON;
  }): Promise<void> {
    const state = await this.registrationStates.findByStateId(input.stateId);
    if (!state) throw new RegistrationStateNotFound();
    if (!RegistrationState.isValid(state, new Date()))
      throw new RegistrationStateExpired();

    await this.registrationStates.delete(input.stateId);

    const { credentialId, publicKey, counter } =
      await this.verifier.verifyRegistration({
        challenge: state.challenge,
        attestation: input.attestation,
      });

    await this.uow.run(async (repos) => {
      const user = await repos.users.create({
        name: `user-${crypto.randomUUID()}`,
        webauthnUserId: state.webauthnUserId,
      });
      await repos.passkeys.create({
        userId: user.id,
        credentialId,
        publicKey,
        counter,
      });
      await consumeInviteLink(repos, {
        token: state.inviteToken,
        userId: user.id,
      });
    });
  }
}
