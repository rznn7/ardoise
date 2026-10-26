import { type Member, type NamedMember } from './member';

export const MEMBER_REPOSITORY = Symbol('MEMBER_REPOSITORY');

export interface MemberRepository {
  findById(id: number): Promise<Member | null>;
  findByUserAndGroup(userId: number, groupId: number): Promise<Member | null>;
  findByGroupId(groupId: number): Promise<Member[]>;
  findNamedByGroupId(groupId: number): Promise<NamedMember[]>;
  create(input: {
    userId: number;
    groupId: number;
    nickname?: string;
    isModerator?: boolean;
  }): Promise<Member | null>;
}
