import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { ExpenseGroupModule } from './infrastructure/expense-group/expense-group.module';
import { Module } from '@nestjs/common';
import { UserModule } from './infrastructure/user/user.module';

@Module({
  imports: [ConfigModule.forRoot(), UserModule, ExpenseGroupModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
