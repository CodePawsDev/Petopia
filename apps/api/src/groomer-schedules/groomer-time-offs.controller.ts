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
import { CreateTimeOffDto } from './dto/create-time-off.dto';
import { GroomerTimeOffsService } from './groomer-time-offs.service';

@Controller('branches/:branchId/groomers/:groomerId/time-offs')
@UseGuards(SessionAuthGuard, BranchManagerGuard)
export class GroomerTimeOffsController {
  constructor(
    private readonly groomerTimeOffsService: GroomerTimeOffsService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  findAll(
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
    @Param('groomerId', new ParseUUIDPipe()) groomerId: string,
  ) {
    return this.groomerTimeOffsService.findAll(branchId, groomerId);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  create(
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
    @Param('groomerId', new ParseUUIDPipe()) groomerId: string,
    @Body() dto: CreateTimeOffDto,
  ) {
    return this.groomerTimeOffsService.create(branchId, groomerId, dto);
  }

  @Delete(':timeOffId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Header('Cache-Control', 'no-store')
  remove(
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
    @Param('groomerId', new ParseUUIDPipe()) groomerId: string,
    @Param('timeOffId', new ParseUUIDPipe()) timeOffId: string,
  ): Promise<void> {
    return this.groomerTimeOffsService.remove(branchId, groomerId, timeOffId);
  }
}
