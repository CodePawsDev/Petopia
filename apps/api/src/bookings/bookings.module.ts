import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AvailabilityModule } from '../availability/availability.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BookingsCancelService } from './bookings-cancel.service';
import { BookingsController } from './bookings.controller';
import { BookingsReadService } from './bookings-read.service';
import { BookingsService } from './bookings.service';
import { BranchBookingsController } from './branch-bookings.controller';
import { BranchBookingsService } from './branch-bookings.service';

@Module({
  imports: [AuthModule, AuthorizationModule, AvailabilityModule, PrismaModule],
  controllers: [BookingsController, BranchBookingsController],
  providers: [
    BookingsService,
    BookingsReadService,
    BookingsCancelService,
    BranchBookingsService,
  ],
})
export class BookingsModule {}
