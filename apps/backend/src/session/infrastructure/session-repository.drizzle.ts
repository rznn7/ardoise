import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type Session, type StoredSession } from 'src/session/domain/session';
import { SessionRepository } from 'src/session/domain/session-repository';
import {
  type Database,
  DATABASE_CONNECTION,
} from 'src/shared/database/database.module';
import { session } from 'src/shared/database/schema';

export class SessionRepositoryDrizzle implements SessionRepository {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  async findById(id: number): Promise<StoredSession | null> {
    const row = await this.database.query.session.findFirst({
      where: eq(session.id, id),
    });

    return row ? this.toDomain(row) : null;
  }

  async findByToken(token: string): Promise<StoredSession | null> {
    const row = await this.database.query.session.findFirst({
      where: eq(session.token, token),
    });

    return row ? this.toDomain(row) : null;
  }

  async save(sessionToSave: Session): Promise<void> {
    await this.database
      .insert(session)
      .values({
        token: sessionToSave.token,
        userId: sessionToSave.userId,
        issuedAt: sessionToSave.issuedAt,
        expiresAt: sessionToSave.expiresAt,
        revokedAt: sessionToSave.revokedAt,
      })
      .onConflictDoUpdate({
        target: session.token,
        set: { revokedAt: sessionToSave.revokedAt },
      });
  }

  private toDomain(row: typeof session.$inferSelect): StoredSession {
    return {
      id: row.id,
      token: row.token,
      userId: row.userId,
      issuedAt: row.issuedAt,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
    };
  }
}
