import * as schema from './schema';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NodePgDatabase, drizzle } from 'drizzle-orm/node-postgres';
import { Module } from '@nestjs/common';

export const DATABASE_CONNECTION = Symbol('DATABASE_CONNECTION');
export type Database = NodePgDatabase<typeof schema>;

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DATABASE_CONNECTION,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL');
        if (!url) throw new Error('DATABASE_URL missing');
        return drizzle(url, { schema, casing: 'snake_case' });
      },
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
