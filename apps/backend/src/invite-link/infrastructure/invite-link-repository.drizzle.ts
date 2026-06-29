import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { InviteLink } from 'src/invite-link/domain/invite-link';
import { type InviteLinkRepository } from 'src/invite-link/domain/invite-link-repository';
import {
  type Database,
  DATABASE_CONNECTION,
} from 'src/shared/database/database.module';
import { inviteLink } from 'src/shared/database/schema';

@Injectable()
export class InviteLinkRepositoryDrizzle implements InviteLinkRepository {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  async findUsableByToken(token: string): Promise<InviteLink | null> {
    const row = await this.database.query.inviteLink.findFirst({
      where: and(eq(inviteLink.token, token), this.isUsable()),
    });

    return row ? this.toDomain(row) : null;
  }

  async findByToken(token: string): Promise<InviteLink | null> {
    const row = await this.database.query.inviteLink.findFirst({
      where: eq(inviteLink.token, token),
    });

    return row ? this.toDomain(row) : null;
  }

  async markBurned(id: number, userId: number): Promise<void> {
    await this.database
      .update(inviteLink)
      .set({
        burnedByUserId: userId,
        burnedAt: new Date(),
      })
      .where(and(eq(inviteLink.id, id), this.isUsable()));
  }

  async create(input: {
    token: string;
    groupId: number;
    expiresAt: Date;
    singleUse: boolean;
  }): Promise<InviteLink> {
    const [row] = await this.database
      .insert(inviteLink)
      .values(input)
      .returning();

    if (row === undefined)
      throw new Error('could not create invite link in database');

    return this.toDomain(row);
  }

  private toDomain(row: typeof inviteLink.$inferSelect): InviteLink {
    return {
      id: row.id,
      groupId: row.groupId,
      token: row.token,
      singleUse: row.singleUse,
      burnedByUserId: row.burnedByUserId,
      expiresAt: row.expiresAt,
      burnedAt: row.burnedAt,
      createdAt: row.createdAt,
    };
  }

  private isUsable() {
    return and(
      isNull(inviteLink.burnedAt),
      isNull(inviteLink.burnedByUserId),
      gt(inviteLink.expiresAt, new Date()),
    );
  }
}
