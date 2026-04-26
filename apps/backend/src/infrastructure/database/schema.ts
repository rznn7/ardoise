import {
  boolean,
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
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().$onUpdate(() => new Date()),
};

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

export const users = pgTable('users', {
  id,
  name: varchar({ length: 255 }).notNull(),
  role: userRoleEnum().default('user').notNull(),
  ...timestamps,
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
  expenseGroupId: integer()
    .references(() => expenseGroup.id)
    .notNull(),
  title: varchar({ length: 255 }).notNull(),
  paidAt: timestamp().notNull(),
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
