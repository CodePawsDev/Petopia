import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { BranchGroomerGuard } from '../authorization/guards/branch-groomer.guard';
import { BranchManagerGuard } from '../authorization/guards/branch-manager.guard';
import { BranchBookingsService } from './branch-bookings.service';
import { ListBranchBookingsDto } from './dto/list-branch-bookings.dto';

@Controller('branches/:branchId')
@UseGuards(SessionAuthGuard)
export class BranchBookingsController {
  constructor(private readonly branchBookingsService: BranchBookingsService) {}

  @Get('bookings')
  @UseGuards(BranchManagerGuard)
  @Header('Cache-Control', 'no-store')
  findForManager(
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
    @Query() query: ListBranchBookingsDto,
  ) {
    return this.branchBookingsService.findForManager(branchId, query);
  }

  @Get('my-bookings')
  @UseGuards(BranchGroomerGuard)
  @Header('Cache-Control', 'no-store')
  findForGroomer(
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
    @Query() query: ListBranchBookingsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.currentUser) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.branchBookingsService.findForGroomer(
      branchId,
      req.currentUser.id,
      query,
    );
  }
}
