import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type Session } from 'src/domain/auth/session';
import { SessionRepository } from 'src/domain/auth/session-repository';
import {
  type Database,
  DATABASE_CONNECTION,
} from 'src/infrastructure/database/database.module';
import { session } from 'src/infrastructure/database/schema';

export class SessionRepositoryDrizzle implements SessionRepository {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  async findByToken(token: string): Promise<Session | null> {
    const row = await this.database.query.session.findFirst({
      where: eq(session.token, token),
    });

    return row ? this.toDomain(row) : null;
  }

  async save(sessionToSave: Session): Promise<void> {
    await this.database
      .insert(session)
      .values(sessionToSave)
      .onConflictDoUpdate({
        target: session.token,
        set: { revokedAt: sessionToSave.revokedAt },
      });
  }

  private toDomain(row: typeof session.$inferSelect): Session {
    return {
      token: row.token,
      userId: row.userId,
      issuedAt: row.issuedAt,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
    };
  }
}
