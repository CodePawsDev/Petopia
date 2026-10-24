import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { BranchManagerGuard } from '../authorization/guards/branch-manager.guard';
import { BranchClosuresService } from './branch-closures.service';
import { CreateBranchClosureDto } from './dto/create-branch-closure.dto';

@Controller('branches/:branchId/closures')
@UseGuards(SessionAuthGuard, BranchManagerGuard)
export class BranchClosuresController {
  constructor(private readonly branchClosuresService: BranchClosuresService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  findAll(@Param('branchId', new ParseUUIDPipe()) branchId: string) {
    return this.branchClosuresService.findAll(branchId);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  create(
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
    @Body() dto: CreateBranchClosureDto,
  ) {
    return this.branchClosuresService.create(branchId, dto);
  }

  @Delete(':closureId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  remove(
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
    @Param('closureId', new ParseUUIDPipe()) closureId: string,
  ): Promise<void> {
    return this.branchClosuresService.remove(branchId, closureId);
  }
}
