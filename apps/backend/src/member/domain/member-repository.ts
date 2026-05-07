import { type Member } from './member';

export const MEMBER_REPOSITORY = Symbol('MEMBER_REPOSITORY');

export interface MemberRepository {
  findById(id: number): Promise<Member | null>;
  create(input: {
    userId: number;
    groupId: number;
    nickname?: string;
    isModerator?: boolean;
  }): Promise<Member>;
}
