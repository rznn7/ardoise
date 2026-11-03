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
import {
  REALTIME_PUBLISHER,
  type RealtimePublisher,
} from 'src/realtime/domain/realtime-publisher';
import { Session, SESSION_TTL_MS } from 'src/session/domain/session';
import {
  TOKEN_GENERATOR,
  type TokenGenerator,
} from 'src/shared/token-generator/token-generator';

@Injectable()
export class CompleteRegistrationUseCase {
  constructor(
    @Inject(PASSKEY_VERIFIER) private readonly verifier: PasskeyVerifier,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(TOKEN_GENERATOR) private readonly tokenGenerator: TokenGenerator,
    @Inject(REGISTRATION_STATE_REPOSITORY)
    private readonly registrationStates: RegistrationStateRepository,
    @Inject(REALTIME_PUBLISHER) private readonly realtime: RealtimePublisher,
  ) {}

  async execute(input: {
    stateId: string;
    attestation: RegistrationResponseJSON;
  }): Promise<{ token: string }> {
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

    const { token, joined } = await this.uow.run(async (repos) => {
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
      const joined = await consumeInviteLink(repos, {
        token: state.inviteToken,
        userId: user.id,
      });

      const now = new Date();
      const token = this.tokenGenerator.generate();
      const session = Session.issue(token, user.id, now, SESSION_TTL_MS);
      await repos.sessions.save(session);

      return { token, joined: { ...joined, userId: user.id } };
    });

    if (!joined.alreadyMember) {
      await this.realtime.groupChanged({
        type: 'member.joined',
        groupId: joined.groupId,
        userId: joined.userId,
      });
    }
    return { token };
  }
}
