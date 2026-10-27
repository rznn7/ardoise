import { z } from 'zod';

import { type Endpoint } from './http.js';

const role = z.enum(['user', 'admin']);

export const adminOverviewSchema = z.object({
  counts: z.object({
    users: z.number(),
    groups: z.number(),
    payments: z.number(),
  }),
  users: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      role,
      createdAt: z.string(),
      lastSignInAt: z.string().nullable(),
      groupCount: z.number(),
    }),
  ),
  groups: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      currencyCode: z.string(),
      createdAt: z.string(),
      memberCount: z.number(),
      paymentCount: z.number(),
    }),
  ),
});
export type AdminOverview = z.infer<typeof adminOverviewSchema>;

export const adminUserSchema = z.object({
  user: z.object({
    id: z.number(),
    name: z.string(),
    role,
    createdAt: z.string(),
    lastSignInAt: z.string().nullable(),
    passkeyCount: z.number(),
  }),
  groups: z.array(
    z.object({
      groupId: z.number(),
      name: z.string(),
      currencyCode: z.string(),
      isModerator: z.boolean(),
      memberCount: z.number(),
      balance: z.number().int(),
    }),
  ),
  sessions: z.array(
    z.object({
      id: z.number(),
      issuedAt: z.string(),
      expiresAt: z.string(),
      current: z.boolean(),
    }),
  ),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const inviteLinkStatusSchema = z.enum([
  'active',
  'used',
  'expired',
  'revoked',
]);
export type InviteLinkStatusResponse = z.infer<typeof inviteLinkStatusSchema>;

export const adminGroupSchema = z.object({
  group: z.object({
    id: z.number(),
    name: z.string(),
    currencyCode: z.string(),
    createdAt: z.string(),
    paymentCount: z.number(),
    totalSpent: z.number().int(),
  }),
  members: z.array(
    z.object({
      memberId: z.number(),
      userId: z.number(),
      name: z.string(),
      isModerator: z.boolean(),
      balance: z.number().int(),
    }),
  ),
  inviteLinks: z.array(
    z.object({
      id: z.number(),
      singleUse: z.boolean(),
      status: inviteLinkStatusSchema,
      expiresAt: z.string(),
      burnedAt: z.string().nullable(),
      burnedByName: z.string().nullable(),
      revokedAt: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
});
export type AdminGroup = z.infer<typeof adminGroupSchema>;

export const adminErrorSchema = z.object({
  error: z.enum(['NOT_AN_ADMIN', 'CANNOT_REVOKE_CURRENT_SESSION']),
});

export const adminApi = {
  overview: {
    method: 'GET',
    path: '/admin/overview',
    res: adminOverviewSchema,
  },
  user: { method: 'GET', path: '/admin/users/:userId', res: adminUserSchema },
  group: {
    method: 'GET',
    path: '/admin/groups/:groupId',
    res: adminGroupSchema,
  },
  revokeInviteLink: {
    method: 'POST',
    path: '/admin/invite-links/:id/revoke',
    status: 204,
  },
  revokeSession: {
    method: 'POST',
    path: '/admin/sessions/:id/revoke',
    status: 204,
  },
} as const satisfies Record<string, Endpoint>;
