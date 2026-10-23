import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { AvailabilityService } from './availability.service';
import { SearchAvailabilityDto } from './dto/search-availability.dto';

@Controller('availability')
@UseGuards(SessionAuthGuard)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  search(@Body() dto: SearchAvailabilityDto, @Req() req: AuthenticatedRequest) {
    if (!req.currentUser) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.availabilityService.search(req.currentUser.id, dto);
  }
}
