import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../../src/auth/guards/session-auth.guard';
import { BranchManagerGuard } from '../../src/authorization/guards/branch-manager.guard';
import { ReceivePaymentGuard } from '../../src/authorization/guards/receive-payment.guard';

@Controller('test/branches')
export class AuthorizationTestController {
  @Get(':branchId/manager')
  @UseGuards(SessionAuthGuard, BranchManagerGuard)
  managerAccess() {
    return { allowed: true };
  }

  @Get(':branchId/receive-payment')
  @UseGuards(SessionAuthGuard, ReceivePaymentGuard)
  receivePaymentAccess() {
    return { allowed: true };
  }
}
