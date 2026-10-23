import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { BookingsReadService } from './bookings-read.service';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ListBookingsDto } from './dto/list-bookings.dto';
import { BookingsCancelService } from './bookings-cancel.service';

@Controller('bookings')
@UseGuards(SessionAuthGuard)
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly bookingsReadService: BookingsReadService,
    private readonly bookingsCancelService: BookingsCancelService,
  ) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  create(@Body() dto: CreateBookingDto, @Req() req: AuthenticatedRequest) {
    if (!req.currentUser) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.bookingsService.create(req.currentUser.id, dto);
  }
  @Post(':bookingId/cancel')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  cancel(
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.currentUser) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.bookingsCancelService.cancel(req.currentUser.id, bookingId);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  findAll(@Query() query: ListBookingsDto, @Req() req: AuthenticatedRequest) {
    if (!req.currentUser) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.bookingsReadService.findAll(req.currentUser.id, query);
  }

  @Get(':bookingId')
  @Header('Cache-Control', 'no-store')
  findOne(
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.currentUser) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.bookingsReadService.findOne(req.currentUser.id, bookingId);
  }
}
