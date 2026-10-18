import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthorizationService } from './authorization.service';
import { BranchManagerGuard } from './guards/branch-manager.guard';
import { ReceivePaymentGuard } from './guards/receive-payment.guard';

@Module({
  imports: [PrismaModule],
  providers: [AuthorizationService, BranchManagerGuard, ReceivePaymentGuard],
  exports: [AuthorizationService, BranchManagerGuard, ReceivePaymentGuard],
})
export class AuthorizationModule {}
