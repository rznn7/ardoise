import { type GroupMember, type MemberResponse } from '@ardoise/shared';
import { type Member } from 'src/member/domain/member';

export const toGroupMember = (member: Member): GroupMember => ({
  id: member.id,
  userId: member.userId,
  nickname: member.nickname,
  isModerator: member.isModerator,
});

export const toMemberResponse = (member: Member): MemberResponse => ({
  id: member.id,
  userId: member.userId,
  groupId: member.groupId,
  nickname: member.nickname,
  isModerator: member.isModerator,
});
