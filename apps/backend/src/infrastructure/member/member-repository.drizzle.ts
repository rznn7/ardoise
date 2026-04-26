import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Member } from 'src/domain/member/member';
import { MemberRepository } from 'src/domain/member/member-repository';
import {
  DATABASE_CONNECTION,
  type Database,
} from '../database/database.module';
import { member } from '../database/schema';

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

  private toDomain(row: typeof member.$inferSelect): Member {
    return {
      id: row.id,
      userId: row.userId,
      groupId: row.groupId,
      nickname: row.nickname,
      isAdmin: row.isAdmin,
    };
  }
}
