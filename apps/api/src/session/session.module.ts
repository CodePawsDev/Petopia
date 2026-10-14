import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SessionStoreService } from './session-store.service';

@Module({
  imports: [ConfigModule],
  providers: [SessionStoreService],
  exports: [SessionStoreService],
})
export class SessionModule {}
