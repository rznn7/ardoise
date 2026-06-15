import { describe, expect, it } from 'vitest';

import { toGroupMember, toMemberResponse } from './member.mapper';

const member = {
  id: 3,
  userId: 11,
  groupId: 5,
  nickname: 'Al',
  isModerator: true,
};

describe('toGroupMember', () => {
  it('maps a domain member to the group member contract (no groupId)', () => {
    expect(toGroupMember(member)).toEqual({
      id: 3,
      userId: 11,
      nickname: 'Al',
      isModerator: true,
    });
  });

  it('passes a null nickname through', () => {
    expect(toGroupMember({ ...member, nickname: null }).nickname).toBeNull();
  });
});

describe('toMemberResponse', () => {
  it('maps a domain member to the member response contract (with groupId)', () => {
    expect(toMemberResponse(member)).toEqual({
      id: 3,
      userId: 11,
      groupId: 5,
      nickname: 'Al',
      isModerator: true,
    });
  });
});
