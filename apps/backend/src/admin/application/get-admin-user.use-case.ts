import { Inject, Injectable } from '@nestjs/common';
import { AdminUserNotFound, assertAdmin } from 'src/admin/domain/admin';
import {
  ADMIN_READ_REPOSITORY,
  type AdminReadRepository,
  type AdminUserRead,
} from 'src/admin/domain/admin-read-repository';
import {
  BALANCE_REPOSITORY,
  type BalanceRepository,
} from 'src/balance/domain/balance-repository';
import { netOf } from 'src/balance/domain/net-balances';
import { type SessionUser } from 'src/shared/http/express';

export type AdminUserDetail = {
  user: AdminUserRead['user'];
  groups: (AdminUserRead['groups'][number] & { balance: number })[];
  sessions: { id: number; issuedAt: Date; expiresAt: Date; current: boolean }[];
};

@Injectable()
export class GetAdminUserUseCase {
  constructor(
    @Inject(ADMIN_READ_REPOSITORY) private readonly admin: AdminReadRepository,
    @Inject(BALANCE_REPOSITORY) private readonly ledger: BalanceRepository,
  ) {}

  async execute({
    caller,
    userId,
    currentToken,
  }: {
    caller: SessionUser;
    userId: number;
    currentToken: string | undefined;
  }): Promise<AdminUserDetail> {
    assertAdmin(caller);
    const read = await this.admin.user(userId, new Date());
    if (!read) throw new AdminUserNotFound();

    const totals = await this.ledger.totalsOfUser(userId);
    const balanceIn = (groupId: number): number => {
      const mine = totals.find((t) => t.groupId === groupId);
      return mine ? netOf(mine) : 0;
    };

    return {
      user: read.user,
      groups: read.groups.map((group) => ({
        ...group,
        balance: balanceIn(group.groupId),
      })),
      sessions: read.activeSessions.map(
        ({ id, token, issuedAt, expiresAt }) => ({
          id,
          issuedAt,
          expiresAt,
          current: token === currentToken,
        }),
      ),
    };
  }
}
