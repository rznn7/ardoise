import { ConfigModule, ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';

export const DB = Symbol('DB');

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DB,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL');
        if (!url) throw new Error('DATABASE_URL missing');
        return drizzle(url, { casing: 'snake_case' });
      },
    },
  ],
  exports: [DB],
})
export class DatabaseModule {}
