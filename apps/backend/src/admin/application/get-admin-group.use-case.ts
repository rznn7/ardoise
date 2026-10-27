import { Inject, Injectable } from '@nestjs/common';
import { AdminGroupNotFound, assertAdmin } from 'src/admin/domain/admin';
import {
  ADMIN_READ_REPOSITORY,
  type AdminGroupRead,
  type AdminReadRepository,
} from 'src/admin/domain/admin-read-repository';
import {
  BALANCE_REPOSITORY,
  type BalanceRepository,
} from 'src/balance/domain/balance-repository';
import { netBalances } from 'src/balance/domain/net-balances';
import {
  InviteLink,
  type InviteLinkStatus,
} from 'src/invite-link/domain/invite-link';
import { type SessionUser } from 'src/shared/http/express';

export type AdminGroupDetail = {
  group: AdminGroupRead['group'];
  members: (AdminGroupRead['members'][number] & { balance: number })[];
  inviteLinks: (AdminGroupRead['inviteLinks'][number] & {
    status: InviteLinkStatus;
  })[];
};

@Injectable()
export class GetAdminGroupUseCase {
  constructor(
    @Inject(ADMIN_READ_REPOSITORY) private readonly admin: AdminReadRepository,
    @Inject(BALANCE_REPOSITORY) private readonly ledger: BalanceRepository,
  ) {}

  async execute({
    caller,
    groupId,
  }: {
    caller: SessionUser;
    groupId: number;
  }): Promise<AdminGroupDetail> {
    assertAdmin(caller);
    const read = await this.admin.group(groupId);
    if (!read) throw new AdminGroupNotFound();

    const balances = new Map(
      netBalances(await this.ledger.totalsByGroup(groupId)).map((b) => [
        b.memberId,
        b.amount,
      ]),
    );
    const now = new Date();

    return {
      group: read.group,
      members: read.members.map((member) => ({
        ...member,
        balance: balances.get(member.memberId) ?? 0,
      })),
      inviteLinks: read.inviteLinks.map((link) => ({
        ...link,
        status: InviteLink.status(link, now),
      })),
    };
  }
}
