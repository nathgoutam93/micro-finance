import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { KycsModule } from './kycs/kycs.module';
import { PlansModule } from './plans/plans.module';
import { DepositsModule } from './deposits/deposits.module';
import { LoansModule } from './loans/loans.module';
import { WalletModule } from './wallet/wallet.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';
import { NotificationModule } from './notification/notification.module';
import { SettingsModule } from './settings/settings.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AdminModule } from './admin/admin.module';
import { AgentModule } from './agent/agent.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    DatabaseModule,
    StorageModule,
    NotificationModule,
    AuthModule,
    AdminModule,
    AgentModule,
    UsersModule,
    SettingsModule,
    PlansModule,
    DepositsModule,
    LoansModule,
    WalletModule,
    KycsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}