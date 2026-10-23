import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { BranchManagerGuard } from '../authorization/guards/branch-manager.guard';
import { ReplaceWeeklyScheduleDto } from './dto/replace-weekly-schedule.dto';
import { GroomerSchedulesService } from './groomer-schedules.service';

@Controller('branches/:branchId/groomers/:groomerId')
@UseGuards(SessionAuthGuard, BranchManagerGuard)
export class GroomerSchedulesController {
  constructor(
    private readonly groomerSchedulesService: GroomerSchedulesService,
  ) {}

  @Get('weekly-schedule')
  @Header('Cache-Control', 'no-store')
  getWeeklySchedule(
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
    @Param('groomerId', new ParseUUIDPipe()) groomerId: string,
  ) {
    return this.groomerSchedulesService.getWeeklySchedule(branchId, groomerId);
  }

  @Put('weekly-schedule')
  @Header('Cache-Control', 'no-store')
  replaceWeeklySchedule(
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
    @Param('groomerId', new ParseUUIDPipe()) groomerId: string,
    @Body() dto: ReplaceWeeklyScheduleDto,
  ) {
    return this.groomerSchedulesService.replaceWeeklySchedule(
      branchId,
      groomerId,
      dto,
    );
  }
}
