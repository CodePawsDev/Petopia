import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AvailabilityModule } from '../availability/availability.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BookingsCancelService } from './bookings-cancel.service';
import { BookingsController } from './bookings.controller';
import { BookingsReadService } from './bookings-read.service';
import { BookingsService } from './bookings.service';

@Module({
  imports: [AuthModule, AvailabilityModule, PrismaModule],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsReadService, BookingsCancelService],
})
export class BookingsModule {}
