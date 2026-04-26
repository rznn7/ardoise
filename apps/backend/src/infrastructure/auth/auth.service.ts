import { randomBytes } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RegistrationResponseJSON,
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import {
  INVITE_LINK_REPOSITORY,
  type InviteLinkRepository,
} from 'src/domain/invite-link/invite-link-repository';
import {
  DATABASE_CONNECTION,
  type Database,
} from '../database/database.module';
import { member, passkey, users } from '../database/schema';

interface RegistrationState {
  challenge: Base64URLString;
  webauthnUserId: string;
  inviteToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    @Inject(INVITE_LINK_REPOSITORY)
    private readonly inviteLinkRepo: InviteLinkRepository,
    private readonly config: ConfigService,
  ) {}

  async generateRegistrationOptions(inviteToken: string): Promise<{
    options: PublicKeyCredentialCreationOptionsJSON;
    registrationState: RegistrationState;
  }> {
    await this.validateInvite(inviteToken);

    const webauthnUserId = randomBytes(32).toString('base64url');
    const options = await generateRegistrationOptions({
      rpName: this.config.getOrThrow('RP_NAME'),
      rpID: this.config.getOrThrow('RP_ID'),
      userID: new TextEncoder().encode(webauthnUserId),
      userName: 'pending',
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
      attestationType: 'none',
    });

    return {
      options,
      registrationState: {
        challenge: options.challenge,
        webauthnUserId,
        inviteToken,
      },
    };
  }

  async verifyRegistration(
    registrationState: RegistrationState,
    attestation: RegistrationResponseJSON,
    name: string,
  ) {
    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response: attestation,
      expectedChallenge: registrationState.challenge,
      expectedOrigin: this.config.getOrThrow('EXPECTED_ORIGIN'),
      expectedRPID: this.config.getOrThrow('RP_ID'),
    });

    if (!verified)
      throw Error(`could not verify registration`, registrationInfo);

    const { credential } = registrationInfo;

    await this.database.transaction(async (tx) => {
      const inviteLink = await this.validateInvite(
        registrationState.inviteToken,
      );
      const [user] = await tx
        .insert(users)
        .values({
          name,
          webauthnUserId: registrationState.webauthnUserId,
        })
        .returning();
      await tx.insert(passkey).values({
        userId: user.id,
        credentialId: credential.id,
        publicKey: credential.publicKey,
        counter: credential.counter,
      });
      await tx.insert(member).values({
        userId: user.id,
        groupId: inviteLink.groupId,
      });
    });
  }

  private async validateInvite(inviteToken: string) {
    const inviteLink = await this.inviteLinkRepo.findUsableByToken(inviteToken);
    if (!inviteLink)
      throw Error(`no invite-link found for token [${inviteToken}]`);
    return inviteLink;
  }
}
