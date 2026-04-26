import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type Passkey } from 'src/domain/passkey/passkey';
import { type PasskeyRepository } from 'src/domain/passkey/passkey-repository';
import {
  DATABASE_CONNECTION,
  type Database,
} from '../database/database.module';
import { passkey } from '../database/schema';

@Injectable()
export class PasskeyRepositoryDrizzle implements PasskeyRepository {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  async findByCredentialId(id: string): Promise<Passkey | null> {
    const row = await this.database.query.passkey.findFirst({
      where: eq(passkey.credentialId, id),
    });

    return row ? this.toDomain(row) : null;
  }

  async findByUserId(id: number): Promise<Passkey | null> {
    const row = await this.database.query.passkey.findFirst({
      where: eq(passkey.userId, id),
    });

    return row ? this.toDomain(row) : null;
  }

  async create(input: {
    userId: number;
    credentialId: string;
    publicKey: Uint8Array;
    counter: number;
  }): Promise<Passkey> {
    const [row] = await this.database.insert(passkey).values(input).returning();

    return this.toDomain(row);
  }

  async markUsed(id: number, counter: number): Promise<void> {
    await this.database
      .update(passkey)
      .set({ counter, lastUsedAt: new Date() })
      .where(eq(passkey.id, id));
  }

  private toDomain(row: typeof passkey.$inferSelect): Passkey {
    return {
      id: row.id,
      userId: row.userId,
      credentialId: row.credentialId,
      publicKey: row.publicKey,
      counter: row.counter,
      createdAt: row.createdAt,
      lastUsedAt: row.lastUsedAt,
    };
  }
}
