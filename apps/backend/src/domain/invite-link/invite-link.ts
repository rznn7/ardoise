export interface InviteLink {
  id: number;
  groupId: number;
  token: string;
  singleUse: boolean;
  consumedByUserId: number | null;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}
