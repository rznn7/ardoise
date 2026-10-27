import { describe, expect, it, vi } from 'vitest';

import { consumeInviteLink } from './consume-invite-link';
import { InviteLink, InviteLinkExpired } from './invite-link';
import { type InviteLinkRepository } from './invite-link-repository';
import { previewInviteLink } from './preview-invite-link';

const NOW = new Date('2026-10-27T12:00:00.000Z');
const LATER = new Date('2026-11-01T12:00:00.000Z');
const EARLIER = new Date('2026-10-20T12:00:00.000Z');

const link = (overrides: Partial<InviteLink> = {}): InviteLink => ({
  id: 1,
  groupId: 7,
  token: 'token',
  singleUse: true,
  burnedByUserId: null,
  expiresAt: LATER,
  burnedAt: null,
  revokedAt: null,
  createdAt: EARLIER,
  ...overrides,
});

describe('InviteLink.status', () => {
  it('is active while unused and unexpired', () => {
    expect(InviteLink.status(link(), NOW)).toBe('active');
  });

  it('is used once a single-use link is burned', () => {
    expect(
      InviteLink.status(link({ burnedAt: EARLIER, burnedByUserId: 3 }), NOW),
    ).toBe('used');
  });

  it('is expired past its date', () => {
    expect(
      InviteLink.status(link({ singleUse: false, expiresAt: EARLIER }), NOW),
    ).toBe('expired');
  });

  it('is revoked before anything else', () => {
    expect(
      InviteLink.status(
        link({
          revokedAt: EARLIER,
          burnedAt: EARLIER,
          burnedByUserId: 3,
          expiresAt: EARLIER,
        }),
        NOW,
      ),
    ).toBe('revoked');
  });
});

describe('a revoked link', () => {
  const inviteLinks = {
    findByToken: () => Promise.resolve(link({ revokedAt: EARLIER })),
  } as unknown as InviteLinkRepository;

  it('cannot be previewed', async () => {
    await expect(
      previewInviteLink(
        { inviteLinks, expenseGroups: { findById: vi.fn() } as never },
        { token: 'token' },
      ),
    ).rejects.toThrow(InviteLinkExpired);
  });

  it('cannot be consumed', async () => {
    await expect(
      consumeInviteLink(
        {
          inviteLinks,
          members: { findByUserAndGroup: () => Promise.resolve(null) } as never,
        },
        { token: 'token', userId: 5 },
      ),
    ).rejects.toThrow(InviteLinkExpired);
  });
});
