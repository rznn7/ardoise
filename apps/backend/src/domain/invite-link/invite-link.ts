export type InviteLink = {
  readonly id: number;
  readonly groupId: number;
  readonly token: string;
  readonly singleUse: boolean;
  readonly consumedByUserId: number | null;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
  readonly createdAt: Date;
};
