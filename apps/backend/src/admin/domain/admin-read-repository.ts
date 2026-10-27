import { type InviteLink } from 'src/invite-link/domain/invite-link';

export const ADMIN_READ_REPOSITORY = Symbol('ADMIN_READ_REPOSITORY');

type Role = 'user' | 'admin';

export type AdminOverviewRead = {
  readonly counts: { users: number; groups: number; payments: number };
  readonly users: readonly {
    id: number;
    name: string;
    role: Role;
    createdAt: Date;
    lastSignInAt: Date | null;
    groupCount: number;
  }[];
  readonly groups: readonly {
    id: number;
    name: string;
    currencyCode: string;
    createdAt: Date;
    memberCount: number;
    paymentCount: number;
  }[];
};

export type AdminUserRead = {
  readonly user: {
    id: number;
    name: string;
    role: Role;
    createdAt: Date;
    lastSignInAt: Date | null;
    passkeyCount: number;
  };
  readonly groups: readonly {
    groupId: number;
    name: string;
    currencyCode: string;
    isModerator: boolean;
    memberCount: number;
  }[];
  readonly activeSessions: readonly {
    id: number;
    token: string;
    issuedAt: Date;
    expiresAt: Date;
  }[];
};

export type AdminGroupRead = {
  readonly group: {
    id: number;
    name: string;
    currencyCode: string;
    createdAt: Date;
    paymentCount: number;
    totalSpent: number;
  };
  readonly members: readonly {
    memberId: number;
    userId: number;
    name: string;
    isModerator: boolean;
  }[];
  readonly inviteLinks: readonly (InviteLink & {
    burnedByName: string | null;
  })[];
};

export interface AdminReadRepository {
  overview(): Promise<AdminOverviewRead>;
  user(userId: number, now: Date): Promise<AdminUserRead | null>;
  group(groupId: number): Promise<AdminGroupRead | null>;
}
