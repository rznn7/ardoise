import { randomBytes } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/server';
import {
  PASSKEY_VERIFIER,
  type PasskeyVerifier,
} from 'src/domain/auth/passkey-verifier';
import { type RegistrationState } from 'src/domain/auth/registration-state';
import {
  INVITE_LINK_REPOSITORY,
  type InviteLinkRepository,
} from 'src/domain/invite-link/invite-link-repository';

@Injectable()
export class BeginRegistrationUseCase {
  constructor(
    @Inject(PASSKEY_VERIFIER) private readonly verifier: PasskeyVerifier,
    @Inject(INVITE_LINK_REPOSITORY)
    private readonly inviteLinks: InviteLinkRepository,
  ) {}

  async execute(input: { inviteToken: string }): Promise<{
    options: PublicKeyCredentialCreationOptionsJSON;
    registrationState: RegistrationState;
  }> {
    const invite = await this.inviteLinks.findUsableByToken(input.inviteToken);
    if (!invite)
      throw new Error(`no invite-link found for token [${input.inviteToken}]`);

    const webauthnUserId = randomBytes(32).toString('base64url');
    const options = await this.verifier.generateRegistrationOptions({
      webauthnUserId,
    });

    return {
      options,
      registrationState: {
        challenge: options.challenge,
        webauthnUserId,
        inviteToken: input.inviteToken,
      },
    };
  }
}
