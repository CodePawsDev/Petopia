import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListBookingsDto } from './dto/list-bookings.dto';

const bookingSelect = {
  id: true,
  status: true,
  petId: true,
  petName: true,
  petSpecies: true,
  petWeightKg: true,
  startsAt: true,
  serviceEndsAt: true,
  occupiedEndsAt: true,
  timezone: true,
  currency: true,
  totalPriceSatang: true,
  totalDurationMinutes: true,
  bufferMinutes: true,
  createdAt: true,
  updatedAt: true,
  branch: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  groomer: {
    select: {
      id: true,
      displayName: true,
    },
  },
  items: {
    orderBy: { sortOrder: 'asc' },
    select: {
      serviceId: true,
      code: true,
      name: true,
      kind: true,
      priceSatang: true,
      durationMinutes: true,
      sortOrder: true,
    },
  },
} satisfies Prisma.GroomingBookingSelect;

type BookingRecord = Prisma.GroomingBookingGetPayload<{
  select: typeof bookingSelect;
}>;

function serializeBooking(booking: BookingRecord) {
  return {
    ...booking,
    petWeightKg: booking.petWeightKg.toNumber(),
  };
}

@Injectable()
export class BookingsReadService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll(ownerId: string, query: ListBookingsDto) {
    const { page, limit } = query;

    return this.prismaService.$transaction(
      async (tx) => {
        const total = await tx.groomingBooking.count({
          where: { ownerId },
        });

        const bookings = await tx.groomingBooking.findMany({
          where: { ownerId },
          orderBy: [{ startsAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
          select: bookingSelect,
        });

        return {
          items: bookings.map(serializeBooking),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
  }

  async findOne(ownerId: string, bookingId: string) {
    const booking = await this.prismaService.groomingBooking.findFirst({
      where: {
        id: bookingId,
        ownerId,
      },
      select: bookingSelect,
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return serializeBooking(booking);
  }
}
