import {
  type AdminGroup,
  type AdminOverview,
  type AdminUser,
} from '@ardoise/shared';
import { type AdminGroupDetail } from 'src/admin/application/get-admin-group.use-case';
import { type AdminUserDetail } from 'src/admin/application/get-admin-user.use-case';
import { type AdminOverviewRead } from 'src/admin/domain/admin-read-repository';

const iso = (date: Date): string => date.toISOString();
const isoOrNull = (date: Date | null): string | null =>
  date ? iso(date) : null;

export const toAdminOverview = (read: AdminOverviewRead): AdminOverview => ({
  counts: read.counts,
  users: read.users.map((user) => ({
    ...user,
    createdAt: iso(user.createdAt),
    lastSignInAt: isoOrNull(user.lastSignInAt),
  })),
  groups: read.groups.map((group) => ({
    ...group,
    createdAt: iso(group.createdAt),
  })),
});

export const toAdminUser = (detail: AdminUserDetail): AdminUser => ({
  user: {
    ...detail.user,
    createdAt: iso(detail.user.createdAt),
    lastSignInAt: isoOrNull(detail.user.lastSignInAt),
  },
  groups: detail.groups.map((group) => ({ ...group })),
  sessions: detail.sessions.map((s) => ({
    id: s.id,
    issuedAt: iso(s.issuedAt),
    expiresAt: iso(s.expiresAt),
    current: s.current,
  })),
});

export const toAdminGroup = (detail: AdminGroupDetail): AdminGroup => ({
  group: { ...detail.group, createdAt: iso(detail.group.createdAt) },
  members: detail.members.map((m) => ({ ...m })),
  inviteLinks: detail.inviteLinks.map((link) => ({
    id: link.id,
    singleUse: link.singleUse,
    status: link.status,
    expiresAt: iso(link.expiresAt),
    burnedAt: isoOrNull(link.burnedAt),
    burnedByName: link.burnedByName,
    revokedAt: isoOrNull(link.revokedAt),
    createdAt: iso(link.createdAt),
  })),
});
