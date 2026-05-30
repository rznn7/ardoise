import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type RegistrationState } from 'src/auth/domain/registration-state';
import { type RegistrationStateRepository } from 'src/auth/domain/registration-state-repository';
import {
  type Database,
  DATABASE_CONNECTION,
} from 'src/shared/database/database.module';
import { registrationState } from 'src/shared/database/schema';

export class RegistrationStateRepositoryDrizzle implements RegistrationStateRepository {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  async save(state: RegistrationState): Promise<void> {
    await this.database.insert(registrationState).values({
      stateId: state.stateId,
      challenge: state.challenge,
      webauthnUserId: state.webauthnUserId,
      inviteToken: state.inviteToken,
      expiresAt: state.expiresAt,
    });
  }

  async findByStateId(stateId: string): Promise<RegistrationState | null> {
    const row = await this.database.query.registrationState.findFirst({
      where: eq(registrationState.stateId, stateId),
    });
    return row ? this.toDomain(row) : null;
  }

  async delete(stateId: string): Promise<void> {
    await this.database
      .delete(registrationState)
      .where(eq(registrationState.stateId, stateId));
  }

  private toDomain(
    row: typeof registrationState.$inferSelect,
  ): RegistrationState {
    return {
      stateId: row.stateId,
      challenge: row.challenge,
      webauthnUserId: row.webauthnUserId,
      inviteToken: row.inviteToken,
      expiresAt: row.expiresAt,
    };
  }
}
