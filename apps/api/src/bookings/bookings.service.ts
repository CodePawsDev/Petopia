import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { AvailabilityService } from '../availability/availability.service';
import { GroomingBookingStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  async create(ownerId: string, dto: CreateBookingDto) {
    const startsAt = new Date(dto.startsAt);

    if (
      !Number.isFinite(startsAt.getTime()) ||
      startsAt.getUTCSeconds() !== 0 ||
      startsAt.getUTCMilliseconds() !== 0 ||
      startsAt.getUTCMinutes() % 15 !== 0
    ) {
      throw new BadRequestException(
        'Booking start must be on an exact 15-minute boundary',
      );
    }

    const date = new Date(startsAt.getTime() + 7 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    return this.prismaService.$transaction(
      async (tx) => {
        // Match the groomer lock used by schedule and time-off writes.
        // Requests for the same groomer wait here before rechecking slots.
        await tx.$queryRaw`
            SELECT "id"
            FROM "users"
            WHERE "id" = ${dto.groomerId}::uuid
            FOR UPDATE
          `;

        // Keep lock order consistent: groomer, branch, then pet.
        await tx.$queryRaw`
            SELECT "id"
            FROM "branches"
            WHERE "id" = ${dto.branchId}::uuid
            FOR UPDATE
          `;

        await tx.$queryRaw`
            SELECT "id"
            FROM "pets"
            WHERE "id" = ${dto.petId}::uuid
              AND "owner_id" = ${ownerId}::uuid
            FOR UPDATE
          `;

        const availability = await this.availabilityService.searchInTransaction(
          tx,
          ownerId,
          {
            branchId: dto.branchId,
            petId: dto.petId,
            serviceIds: dto.serviceIds,
            groomerId: dto.groomerId,
            date,
          },
        );

        if (availability.reason === 'ASSESSMENT_REQUIRED') {
          throw new BadRequestException(
            'Selected services require assessment before booking',
          );
        }

        const groomer = availability.groomers.find(
          (candidate) => candidate.id === dto.groomerId,
        );

        const slot = groomer?.slots.find(
          (candidate) => candidate.startsAt.getTime() === startsAt.getTime(),
        );

        if (!slot) {
          throw new ConflictException(
            'Selected appointment time is unavailable; search again',
          );
        }

        const quote = availability.quote;

        const booking = await tx.groomingBooking.create({
          data: {
            ownerId,
            petId: quote.pet.id,
            branchId: quote.branch.id,
            groomerId: dto.groomerId,
            status: GroomingBookingStatus.CONFIRMED,
            startsAt: slot.startsAt,
            serviceEndsAt: slot.serviceEndsAt,
            occupiedEndsAt: slot.occupiedEndsAt,
            timezone: availability.timezone,
            petName: quote.pet.name,
            petSpecies: quote.pet.species,
            petWeightKg: quote.pet.weightKg,
            currency: quote.currency,
            totalPriceSatang: quote.totalPriceSatang,
            totalDurationMinutes: quote.totalDurationMinutes,
            bufferMinutes: availability.bufferMinutes,
            items: {
              create: quote.items.map((item, sortOrder) => ({
                serviceId: item.serviceId,
                rateId: item.rateId,
                code: item.code,
                name: item.name,
                kind: item.kind,
                priceSatang: item.priceSatang,
                durationMinutes: item.durationMinutes,
                sortOrder,
              })),
            },
          },
          select: {
            id: true,
            status: true,
            branchId: true,
            groomerId: true,
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
          },
        });

        return {
          ...booking,
          petWeightKg: booking.petWeightKg.toNumber(),
        };
      },
      {
        // Read fresh committed data after waiting for the groomer lock.
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000,
        timeout: 15_000,
      },
    );
  }
}
