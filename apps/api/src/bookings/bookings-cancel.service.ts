import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GroomingBookingStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const cancellationSelect = {
  id: true,
  status: true,
  updatedAt: true,
} satisfies Prisma.GroomingBookingSelect;

@Injectable()
export class BookingsCancelService {
  constructor(private readonly prismaService: PrismaService) {}

  async cancel(ownerId: string, bookingId: string) {
    return this.prismaService.$transaction(
      async (tx) => {
        const initial = await tx.groomingBooking.findFirst({
          where: {
            id: bookingId,
            ownerId,
          },
          select: {
            groomerId: true,
          },
        });

        if (!initial) {
          throw new NotFoundException('Booking not found');
        }

        // Use the same groomer lock as booking creation and schedule writes.
        await tx.$queryRaw`
            SELECT "id"
            FROM "users"
            WHERE "id" = ${initial.groomerId}::uuid
            FOR UPDATE
          `;

        const booking = await tx.groomingBooking.findFirst({
          where: {
            id: bookingId,
            ownerId,
          },
          select: {
            ...cancellationSelect,
            startsAt: true,
          },
        });

        if (!booking) {
          throw new NotFoundException('Booking not found');
        }

        // A repeated request does not change the cancellation timestamp.
        if (booking.status === GroomingBookingStatus.CANCELLED) {
          return {
            id: booking.id,
            status: booking.status,
            updatedAt: booking.updatedAt,
          };
        }

        if (booking.status !== GroomingBookingStatus.CONFIRMED) {
          throw new ConflictException(
            'Only confirmed bookings can be cancelled',
          );
        }

        const now = new Date();

        if (booking.startsAt.getTime() <= now.getTime()) {
          throw new ConflictException(
            'Booking cannot be cancelled at or after its start time',
          );
        }

        const changed = await tx.groomingBooking.updateMany({
          where: {
            id: bookingId,
            ownerId,
            status: GroomingBookingStatus.CONFIRMED,
            startsAt: { gt: now },
          },
          data: {
            status: GroomingBookingStatus.CANCELLED,
          },
        });

        if (changed.count !== 1) {
          throw new ConflictException(
            'Booking changed; reload it before trying again',
          );
        }

        return tx.groomingBooking.findUniqueOrThrow({
          where: { id: bookingId },
          select: cancellationSelect,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000,
        timeout: 15_000,
      },
    );
  }
}
