export type Member = {
  readonly id: number;
  readonly userId: number;
  readonly groupId: number;
  readonly nickname: string | null;
  readonly isModerator: boolean;
};
