import { Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema';

export const DATABASE_CONNECTION = Symbol('DATABASE_CONNECTION');
export type Database = NodePgDatabase<typeof schema>;

@Injectable()
export class DatabaseConnection implements OnModuleDestroy {
  readonly db: Database;
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    const url = config.get<string>('DATABASE_URL');
    if (!url) throw new Error('DATABASE_URL missing');
    this.pool = new Pool({ connectionString: url });
    this.db = drizzle(this.pool, { schema, casing: 'snake_case' });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}

@Module({
  imports: [ConfigModule],
  providers: [
    DatabaseConnection,
    {
      provide: DATABASE_CONNECTION,
      inject: [DatabaseConnection],
      useFactory: (connection: DatabaseConnection) => connection.db,
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
