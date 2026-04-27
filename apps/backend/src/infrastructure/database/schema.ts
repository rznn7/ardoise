import {
  boolean,
  customType,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core';

const id = integer().primaryKey().generatedAlwaysAsIdentity();

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
};

const bytea = customType<{ data: Uint8Array; default: false }>({
  dataType() {
    return 'bytea';
  },
});

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

export const users = pgTable('users', {
  id,
  name: varchar({ length: 255 }).notNull(),
  role: userRoleEnum().default('user').notNull(),
  webauthnUserId: varchar({ length: 64 }).notNull().unique(),
  ...timestamps,
});

export const passkey = pgTable('passkey', {
  id,
  userId: integer()
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  credentialId: varchar({ length: 1024 }).unique().notNull(),
  publicKey: bytea().notNull(),
  counter: integer().notNull().default(0),
  lastUsedAt: timestamp({ withTimezone: true }),
  ...timestamps,
});

export const inviteLink = pgTable('invite_link', {
  id,
  groupId: integer()
    .references(() => expenseGroup.id, {
      onDelete: 'cascade',
    })
    .notNull(),
  token: varchar({ length: 64 }).unique().notNull(),
  singleUse: boolean().notNull().default(true),
  consumedByUserId: integer().references(() => users.id),
  consumedAt: timestamp({ withTimezone: true }),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  ...timestamps,
});

export const session = pgTable('session', {
  token: varchar({ length: 64 }).primaryKey(),
  userId: integer()
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  issuedAt: timestamp({ withTimezone: true }).notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  revokedAt: timestamp({ withTimezone: true }),
});

export const expenseGroup = pgTable('expense_group', {
  id,
  name: varchar({ length: 255 }).notNull(),
  currencyCode: varchar({ length: 3 }).notNull(),
  ...timestamps,
});

export const member = pgTable(
  'member',
  {
    id,
    userId: integer()
      .references(() => users.id)
      .notNull(),
    groupId: integer()
      .references(() => expenseGroup.id)
      .notNull(),
    nickname: varchar({ length: 255 }),
    isModerator: boolean().default(false).notNull(),
    ...timestamps,
  },
  (table) => [unique('member_user_group_uq').on(table.userId, table.groupId)],
);

export const splitTypeEnum = pgEnum('split_type', [
  'equal',
  'percent',
  'shares',
  'exact',
]);

export const payment = pgTable('payment', {
  id,
  payerMemberId: integer()
    .references(() => member.id)
    .notNull(),
  groupId: integer()
    .references(() => expenseGroup.id)
    .notNull(),
  title: varchar({ length: 255 }).notNull(),
  paidAt: timestamp({ withTimezone: true }).notNull(),
  fullAmount: integer().notNull(),
  splitType: splitTypeEnum().notNull(),
  ...timestamps,
});

export const paymentShare = pgTable(
  'payment_share',
  {
    paymentId: integer()
      .references(() => payment.id, { onDelete: 'cascade' })
      .notNull(),
    memberId: integer()
      .references(() => member.id)
      .notNull(),
    inputValue: integer().notNull(),
    amount: integer().notNull(),
  },
  (table) => [primaryKey({ columns: [table.paymentId, table.memberId] })],
);
