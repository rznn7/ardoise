import { type Member } from './member';

export const MEMBER_REPOSITORY = Symbol('MEMBER_REPOSITORY');

export interface MemberRepository {
  findById(id: number): Promise<Member | null>;
  findByUserAndGroup(userId: number, groupId: number): Promise<Member | null>;
  findByGroupId(groupId: number): Promise<Member[]>;
  create(input: {
    userId: number;
    groupId: number;
    nickname?: string;
    isModerator?: boolean;
  }): Promise<Member | null>;
}
