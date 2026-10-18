import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { BranchGroomerGuard } from '../authorization/guards/branch-groomer.guard';
import { BranchManagerGuard } from '../authorization/guards/branch-manager.guard';
import { ReceivePaymentGuard } from '../authorization/guards/receive-payment.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('branches/:branchId/workspaces')
export class BranchWorkspaceController {
  constructor(private readonly prismaService: PrismaService) {}

  @Get('manager')
  @Header('Cache-Control', 'no-store')
  @UseGuards(SessionAuthGuard, BranchManagerGuard)
  manager(@Param('branchId') branchId: string) {
    return this.getWorkspace(branchId, 'manager');
  }

  @Get('groomer')
  @Header('Cache-Control', 'no-store')
  @UseGuards(SessionAuthGuard, BranchGroomerGuard)
  groomer(@Param('branchId') branchId: string) {
    return this.getWorkspace(branchId, 'groomer');
  }

  @Get('payment')
  @Header('Cache-Control', 'no-store')
  @UseGuards(SessionAuthGuard, ReceivePaymentGuard)
  payment(@Param('branchId') branchId: string) {
    return this.getWorkspace(branchId, 'payment');
  }

  private async getWorkspace(
    branchId: string,
    workspace: 'manager' | 'groomer' | 'payment',
  ) {
    const branch = await this.prismaService.branch.findFirst({
      where: {
        id: branchId,
        active: true,
        businessUnit: {
          active: true,
        },
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return {
      workspace,
      branch,
    };
  }
}
