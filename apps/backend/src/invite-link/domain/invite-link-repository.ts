import { type InviteLink } from './invite-link';

export const INVITE_LINK_REPOSITORY = Symbol('INVITE_LINK_REPOSITORY');

export interface InviteLinkRepository {
  findUsableByToken(token: string): Promise<InviteLink | null>;
  markConsumed(id: number, userId: number): Promise<void>;
  create(input: {
    token: string;
    groupId: number;
    expiresAt: Date;
    singleUse: boolean;
  }): Promise<InviteLink>;
}
