import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { InviteLink } from 'src/domain/invite-link/invite-link';
import { type InviteLinkRepository } from 'src/domain/invite-link/invite-link-repository';
import {
  type Database,
  DATABASE_CONNECTION,
} from 'src/infrastructure/database/database.module';
import { inviteLink } from 'src/infrastructure/database/schema';

@Injectable()
export class InviteLinkRepositoryDrizzle implements InviteLinkRepository {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  async findUsableByToken(token: string): Promise<InviteLink | null> {
    const row = await this.database.query.inviteLink.findFirst({
      where: and(eq(inviteLink.token, token), this.isConsumable()),
    });

    return row ? this.toDomain(row) : null;
  }

  async markConsumed(id: number, userId: number): Promise<void> {
    await this.database
      .update(inviteLink)
      .set({
        consumedByUserId: userId,
        consumedAt: new Date(),
      })
      .where(and(eq(inviteLink.id, id), this.isConsumable()));
  }

  private toDomain(row: typeof inviteLink.$inferSelect): InviteLink {
    return {
      id: row.id,
      groupId: row.groupId,
      token: row.token,
      singleUse: row.singleUse,
      consumedByUserId: row.consumedByUserId,
      expiresAt: row.expiresAt,
      consumedAt: row.consumedAt,
      createdAt: row.createdAt,
    };
  }

  private isConsumable() {
    return and(
      isNull(inviteLink.consumedAt),
      isNull(inviteLink.consumedByUserId),
      gt(inviteLink.expiresAt, new Date()),
    );
  }
}
