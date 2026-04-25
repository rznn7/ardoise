import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { User } from 'src/domain/user/user';
import { UserRepository } from 'src/domain/user/user-repository';
import {
  DATABASE_CONNECTION,
  type Database,
} from '../database/database.module';
import { users } from '../database/schema';

@Injectable()
export class UserRepositoryDrizzle implements UserRepository {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  async findById(id: number): Promise<User | null> {
    const row = await this.database.query.users.findFirst({
      where: eq(users.id, id),
    });

    return row ? this.toDomain(row) : null;
  }

  private toDomain(row: typeof users.$inferSelect): User {
    return {
      id: row.id,
      name: row.name,
      role: row.role,
    };
  }
}
