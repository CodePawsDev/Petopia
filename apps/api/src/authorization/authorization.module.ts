import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthorizationService } from './authorization.service';
import { BranchGroomerGuard } from './guards/branch-groomer.guard';
import { BranchManagerGuard } from './guards/branch-manager.guard';
import { ReceivePaymentGuard } from './guards/receive-payment.guard';

@Module({
  imports: [PrismaModule],
  providers: [
    AuthorizationService,
    BranchGroomerGuard,
    BranchManagerGuard,
    ReceivePaymentGuard,
  ],
  exports: [
    AuthorizationService,
    BranchGroomerGuard,
    BranchManagerGuard,
    ReceivePaymentGuard,
  ],
})
export class AuthorizationModule {}
