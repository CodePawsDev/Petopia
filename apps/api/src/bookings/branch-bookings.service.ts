import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListBranchBookingsDto } from './dto/list-branch-bookings.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

const branchBookingSelect = {
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
  owner: {
    select: {
      id: true,
      displayName: true,
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

@Injectable()
export class BranchBookingsService {
  constructor(private readonly prismaService: PrismaService) {}

  findForManager(branchId: string, query: ListBranchBookingsDto) {
    return this.findAll(branchId, query);
  }

  findForGroomer(
    branchId: string,
    groomerId: string,
    query: ListBranchBookingsDto,
  ) {
    return this.findAll(branchId, query, groomerId);
  }

  private async findAll(
    branchId: string,
    query: ListBranchBookingsDto,
    groomerId?: string,
  ) {
    const dayStart = new Date(`${query.date}T00:00:00+07:00`);

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(query.date) ||
      !Number.isFinite(dayStart.getTime()) ||
      new Date(dayStart.getTime() + BANGKOK_OFFSET_MS)
        .toISOString()
        .slice(0, 10) !== query.date
    ) {
      throw new BadRequestException('Invalid booking date');
    }

    const dayEnd = new Date(dayStart.getTime() + DAY_MS);

    return this.prismaService.$transaction(
      async (tx) => {
        const branch = await tx.branch.findFirst({
          where: {
            id: branchId,
            active: true,
            businessUnit: {
              code: 'GROOMING',
              active: true,
            },
          },
          select: {
            id: true,
            code: true,
            name: true,
            timezone: true,
          },
        });

        if (!branch) {
          throw new NotFoundException('Active grooming branch not found');
        }

        if (branch.timezone !== 'Asia/Bangkok') {
          throw new BadRequestException(
            'Branch bookings currently support Asia/Bangkok only',
          );
        }

        const where = {
          branchId,
          startsAt: {
            gte: dayStart,
            lt: dayEnd,
          },
          ...(groomerId ? { groomerId } : {}),
        } satisfies Prisma.GroomingBookingWhereInput;

        const total = await tx.groomingBooking.count({ where });

        const bookings = await tx.groomingBooking.findMany({
          where,
          orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          select: branchBookingSelect,
        });

        return {
          date: query.date,
          timezone: branch.timezone,
          branch,
          items: bookings.map((booking) => ({
            ...booking,
            petWeightKg: booking.petWeightKg.toNumber(),
          })),
          pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
          },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
  }
}
