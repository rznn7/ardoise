import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  PASSKEY_VERIFIER,
  type PasskeyVerifier,
} from 'src/auth/domain/passkey-verifier';
import { RegistrationState } from 'src/auth/domain/registration-state';
import {
  REGISTRATION_STATE_REPOSITORY,
  type RegistrationStateRepository,
} from 'src/auth/domain/registration-state-repository';
import { InviteLinkNotFound } from 'src/invite-link/domain/invite-link';
import {
  INVITE_LINK_REPOSITORY,
  type InviteLinkRepository,
} from 'src/invite-link/domain/invite-link-repository';
import {
  TOKEN_GENERATOR,
  type TokenGenerator,
} from 'src/shared/token-generator/token-generator';

@Injectable()
export class BeginRegistrationUseCase {
  constructor(
    @Inject(PASSKEY_VERIFIER) private readonly verifier: PasskeyVerifier,
    @Inject(INVITE_LINK_REPOSITORY)
    private readonly inviteLinks: InviteLinkRepository,
    @Inject(REGISTRATION_STATE_REPOSITORY)
    private readonly registrationStates: RegistrationStateRepository,
    @Inject(TOKEN_GENERATOR) private readonly tokenGenerator: TokenGenerator,
  ) {}

  async execute(input: { inviteToken: string }): Promise<{
    options: unknown;
    stateId: string;
  }> {
    const invite = await this.inviteLinks.findUsableByToken(input.inviteToken);
    if (!invite) throw new InviteLinkNotFound();

    const webauthnUserId = randomBytes(32).toString('base64url');
    const registrationOpts = await this.verifier.generateRegistrationOptions({
      webauthnUserId,
    });

    const stateId = this.tokenGenerator.generate();
    const state = RegistrationState.create(
      stateId,
      registrationOpts.challenge,
      webauthnUserId,
      input.inviteToken,
      new Date(),
    );
    await this.registrationStates.save(state);

    return { options: registrationOpts.raw, stateId };
  }
}
