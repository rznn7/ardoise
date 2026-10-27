export type InviteLink = {
  readonly id: number;
  readonly groupId: number;
  readonly token: string;
  readonly singleUse: boolean;
  readonly burnedByUserId: number | null;
  readonly expiresAt: Date;
  readonly burnedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
};

export type InviteLinkStatus = 'active' | 'used' | 'expired' | 'revoked';

export const InviteLink = {
  isExpired: (link: InviteLink, now: Date): boolean => link.expiresAt < now,

  isConsumed: (link: InviteLink): boolean =>
    link.singleUse && link.burnedAt !== null,

  isRevoked: (link: InviteLink): boolean => link.revokedAt !== null,

  status: (link: InviteLink, now: Date): InviteLinkStatus => {
    if (InviteLink.isRevoked(link)) return 'revoked';
    if (InviteLink.isConsumed(link)) return 'used';
    if (InviteLink.isExpired(link, now)) return 'expired';
    return 'active';
  },
};

export class InviteLinkNotFound extends Error {}
export class InviteLinkExpired extends Error {}
export class InviteLinkConsumed extends Error {}
