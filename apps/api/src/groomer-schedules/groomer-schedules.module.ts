import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { GroomerSchedulesController } from './groomer-schedules.controller';
import { GroomerSchedulesService } from './groomer-schedules.service';
import { GroomerTimeOffsController } from './groomer-time-offs.controller';
import { GroomerTimeOffsService } from './groomer-time-offs.service';

@Module({
  imports: [AuthModule, AuthorizationModule, PrismaModule],
  controllers: [GroomerSchedulesController, GroomerTimeOffsController],
  providers: [GroomerSchedulesService, GroomerTimeOffsService],
})
export class GroomerSchedulesModule {}
