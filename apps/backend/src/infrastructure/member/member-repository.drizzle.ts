import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Member } from 'src/domain/member/member';
import { MemberRepository } from 'src/domain/member/member-repository';
import {
  type Database,
  DATABASE_CONNECTION,
} from 'src/infrastructure/database/database.module';
import { member } from 'src/infrastructure/database/schema';

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

  async create(input: {
    userId: number;
    groupId: number;
    nickname?: string;
    isModerator?: boolean;
  }): Promise<Member> {
    const [row] = await this.database.insert(member).values(input).returning();

    return this.toDomain(row);
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
