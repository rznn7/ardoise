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

  async findByWebauthnUserId(id: string): Promise<User | null> {
    const row = await this.database.query.users.findFirst({
      where: eq(users.webauthnUserId, id),
    });

    return row ? this.toDomain(row) : null;
  }

  async create(input: { webauthnUserId: string; name: string }): Promise<User> {
    const inserted = await this.database
      .insert(users)
      .values(input)
      .returning();

    return this.toDomain(inserted[0]);
  }

  private toDomain(row: typeof users.$inferSelect): User {
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      webauthnUserId: row.webauthnUserId,
    };
  }
}
