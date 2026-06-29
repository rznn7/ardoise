export type InviteLink = {
  readonly id: number;
  readonly groupId: number;
  readonly token: string;
  readonly singleUse: boolean;
  readonly burnedByUserId: number | null;
  readonly expiresAt: Date;
  readonly burnedAt: Date | null;
  readonly createdAt: Date;
};

export class InviteLinkNotFound extends Error {}
export class InviteLinkExpired extends Error {}
export class InviteLinkConsumed extends Error {}
