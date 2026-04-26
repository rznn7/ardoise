export interface Member {
  id: number;
  userId: number;
  groupId: number;
  nickname: string | null;
  isModerator: boolean;
}
