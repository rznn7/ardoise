import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type LoginState } from 'src/auth/domain/login-state';
import { type LoginStateRepository } from 'src/auth/domain/login-state-repository';
import {
  type Database,
  DATABASE_CONNECTION,
} from 'src/shared/database/database.module';
import { loginState } from 'src/shared/database/schema';

export class LoginStateRepositoryDrizzle implements LoginStateRepository {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  async save(state: LoginState): Promise<void> {
    await this.database.insert(loginState).values({
      stateId: state.stateId,
      challenge: state.challenge,
      expiresAt: state.expiresAt,
    });
  }

  async findByStateId(stateId: string): Promise<LoginState | null> {
    const row = await this.database.query.loginState.findFirst({
      where: eq(loginState.stateId, stateId),
    });
    return row ? this.toDomain(row) : null;
  }

  async delete(stateId: string): Promise<void> {
    await this.database
      .delete(loginState)
      .where(eq(loginState.stateId, stateId));
  }

  private toDomain(row: typeof loginState.$inferSelect): LoginState {
    return {
      stateId: row.stateId,
      challenge: row.challenge,
      expiresAt: row.expiresAt,
    };
  }
}
