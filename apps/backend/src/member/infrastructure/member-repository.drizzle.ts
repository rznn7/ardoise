import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import { Member, NamedMember } from 'src/member/domain/member';
import { MemberRepository } from 'src/member/domain/member-repository';
import {
  type Database,
  DATABASE_CONNECTION,
} from 'src/shared/database/database.module';
import { member, users } from 'src/shared/database/schema';

@Injectable()
export class MemberRepositoryDrizzle implements MemberRepository {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  async findById(id: number): Promise<Member | null> {
    const row = await this.database.query.member.findFirst({
      where: eq(member.id, id),
    });

    return row ? this.toDomain(row) : null;
  }

  async findByUserAndGroup(
    userId: number,
    groupId: number,
  ): Promise<Member | null> {
    const row = await this.database.query.member.findFirst({
      where: and(eq(member.userId, userId), eq(member.groupId, groupId)),
    });

    return row ? this.toDomain(row) : null;
  }

  async findByGroupId(groupId: number): Promise<Member[]> {
    const rows = await this.database.query.member.findMany({
      where: eq(member.groupId, groupId),
      orderBy: asc(member.id),
    });

    return rows.map((row) => this.toDomain(row));
  }

  async findNamedByGroupId(groupId: number): Promise<NamedMember[]> {
    const rows = await this.database
      .select({
        id: member.id,
        userId: member.userId,
        groupId: member.groupId,
        nickname: member.nickname,
        isModerator: member.isModerator,
        name: sql<string>`coalesce(${member.nickname}, ${users.name})`,
      })
      .from(member)
      .innerJoin(users, eq(users.id, member.userId))
      .where(eq(member.groupId, groupId))
      .orderBy(asc(member.id));

    return rows;
  }

  async create(input: {
    userId: number;
    groupId: number;
    nickname?: string;
    isModerator?: boolean;
  }): Promise<Member | null> {
    const [row] = await this.database
      .insert(member)
      .values(input)
      .onConflictDoNothing({ target: [member.userId, member.groupId] })
      .returning();

    return row ? this.toDomain(row) : null;
  }

  private toDomain(row: typeof member.$inferSelect): Member {
    return {
      id: row.id,
      userId: row.userId,
      groupId: row.groupId,
      nickname: row.nickname,
      isModerator: row.isModerator,
    };
  }
}
