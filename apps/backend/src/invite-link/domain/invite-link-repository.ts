import { type InviteLink } from './invite-link';

export const INVITE_LINK_REPOSITORY = Symbol('INVITE_LINK_REPOSITORY');

export interface InviteLinkRepository {
  findById(id: number): Promise<InviteLink | null>;
  findByToken(token: string): Promise<InviteLink | null>;
  revoke(id: number, now: Date): Promise<void>;
  findUsableByToken(token: string): Promise<InviteLink | null>;
  markBurned(id: number, userId: number): Promise<void>;
  create(input: {
    token: string;
    groupId: number;
    expiresAt: Date;
    singleUse: boolean;
  }): Promise<InviteLink>;
}
