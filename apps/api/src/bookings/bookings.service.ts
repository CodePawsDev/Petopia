import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AvailabilityService } from '../availability/availability.service';
import {
  GroomingBookingStatus,
  Prisma,
  StaffRole,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';

const bookingSelect = {
  id: true,
  status: true,
  paymentStatus: true,
  branchId: true,
  groomerId: true,
  groomer: {
    select: {
      id: true,
      displayName: true,
    },
  },
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
} satisfies Prisma.GroomingBookingSelect;

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

    const branchId = dto.branchId.toLowerCase();
    const petId = dto.petId.toLowerCase();
    const requestedGroomerId = dto.groomerId?.toLowerCase();
    const serviceIds = dto.serviceIds.map((id) => id.toLowerCase()).sort();
    const requestKey = dto.requestKey.toLowerCase();

    if (new Set(serviceIds).size !== serviceIds.length) {
      throw new BadRequestException('Duplicate services are not allowed');
    }

    // Hash the customer's intent, not the groomer assigned by the server.
    // Explicit-groomer requests retain the previous hash structure.
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          branchId,
          petId,
          groomerId: requestedGroomerId ?? null,
          startsAt: startsAt.toISOString(),
          serviceIds,
        }),
      )
      .digest('hex');

    const date = new Date(startsAt.getTime() + 7 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    return this.prismaService.$transaction(
      async (tx) => {
        const lockName = JSON.stringify([
          'grooming-booking-request',
          ownerId.toLowerCase(),
          requestKey,
        ]);

        await tx.$queryRaw<Array<{ locked: number }>>`
          SELECT 1 AS "locked"
          FROM pg_advisory_xact_lock(
            hashtextextended(${lockName}::text, 0::bigint)
          )
        `;

        const existing = await tx.groomingBookingRequest.findUnique({
          where: {
            ownerId_requestKey: {
              ownerId,
              requestKey,
            },
          },
          select: {
            requestHash: true,
            booking: {
              select: bookingSelect,
            },
          },
        });

        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new ConflictException({
              code: 'BOOKING_REQUEST_REUSED',
              message:
                'This request key has already been used with different booking details',
            });
          }

          // Replay does not search again or assign another groomer.
          return {
            ...existing.booking,
            petWeightKg: existing.booking.petWeightKg.toNumber(),
          };
        }

        const candidateIds = requestedGroomerId
          ? [requestedGroomerId]
          : (
              await tx.user.findMany({
                where: {
                  active: true,
                  staffAssignments: {
                    some: {
                      branchId,
                      role: StaffRole.GROOMER,
                      active: true,
                    },
                  },
                },
                select: { id: true },
                orderBy: { id: 'asc' },
              })
            ).map((candidate) => candidate.id);

        // Lock candidate groomers in UUID order before branch and pet.
        // ANY requests lock the candidate set so competing booking and
        // schedule writes finish before availability is checked again.
        if (candidateIds.length > 0) {
          const ids = Prisma.join(
            candidateIds.map((id) => Prisma.sql`${id}::uuid`),
          );

          await tx.$queryRaw<Array<{ id: string }>>(
            Prisma.sql`
              SELECT "id"
              FROM "users"
              WHERE "id" IN (${ids})
              ORDER BY "id" ASC
              FOR UPDATE
            `,
          );
        }

        await tx.$queryRaw`
          SELECT "id"
          FROM "branches"
          WHERE "id" = ${branchId}::uuid
          FOR UPDATE
        `;

        await tx.$queryRaw`
          SELECT "id"
          FROM "pets"
          WHERE "id" = ${petId}::uuid
            AND "owner_id" = ${ownerId}::uuid
          FOR UPDATE
        `;

        const availability = await this.availabilityService.searchInTransaction(
          tx,
          ownerId,
          {
            branchId,
            petId,
            serviceIds,
            date,
            ...(requestedGroomerId ? { groomerId: requestedGroomerId } : {}),
          },
        );

        if (availability.reason === 'ASSESSMENT_REQUIRED') {
          throw new BadRequestException(
            'Selected services require assessment before booking',
          );
        }

        const lockedIds = new Set(candidateIds);

        // Use a stable candidate order. An unavailable candidate is skipped.
        // Only candidates locked by this transaction may be assigned.
        const candidates = availability.groomers
          .filter((candidate) => lockedIds.has(candidate.id))
          .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

        const groomer = candidates.find((candidate) =>
          candidate.slots.some(
            (slot) => slot.startsAt.getTime() === startsAt.getTime(),
          ),
        );

        const slot = groomer?.slots.find(
          (candidate) => candidate.startsAt.getTime() === startsAt.getTime(),
        );

        if (!groomer || !slot) {
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
            groomerId: groomer.id,
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
          select: bookingSelect,
        });

        await tx.groomingBookingRequest.create({
          data: {
            ownerId,
            requestKey,
            requestHash,
            bookingId: booking.id,
          },
        });

        return {
          ...booking,
          petWeightKg: booking.petWeightKg.toNumber(),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000,
        timeout: 15_000,
      },
    );
  }
}
