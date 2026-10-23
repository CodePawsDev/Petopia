import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StaffRole } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QuotesService } from '../quotes/quotes.service';
import {
  BUFFER_MINUTES,
  SLOT_INTERVAL_MINUTES,
  calculateAvailableSlots,
  type AvailableSlot,
} from './availability-rules';
import { SearchAvailabilityDto } from './dto/search-availability.dto';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const BANGKOK_OFFSET_MS = 7 * 60 * MINUTE_MS;

type GroomerAvailability = {
  id: string;
  displayName: string;
  slots: AvailableSlot[];
};

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly quotesService: QuotesService,
  ) {}

  async search(ownerId: string, dto: SearchAvailabilityDto) {
    const now = new Date();
    const dayStart = new Date(`${dto.date}T00:00:00+07:00`);

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dto.date) ||
      !Number.isFinite(dayStart.getTime()) ||
      new Date(dayStart.getTime() + BANGKOK_OFFSET_MS)
        .toISOString()
        .slice(0, 10) !== dto.date
    ) {
      throw new BadRequestException('Invalid availability date');
    }

    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    const localDay = new Date(
      dayStart.getTime() + BANGKOK_OFFSET_MS,
    ).getUTCDay();
    const weekday = localDay === 0 ? 7 : localDay;

    return this.prismaService.$transaction(
      async (tx) => {
        const quote = await this.quotesService.calculateInTransaction(
          tx,
          ownerId,
          dto,
        );

        const branch = await tx.branch.findUniqueOrThrow({
          where: { id: dto.branchId },
          select: { timezone: true },
        });

        if (branch.timezone !== 'Asia/Bangkok') {
          throw new BadRequestException(
            'Availability currently supports Asia/Bangkok only',
          );
        }

        const candidates = await tx.user.findMany({
          where: {
            active: true,
            ...(dto.groomerId ? { id: dto.groomerId } : {}),
            staffAssignments: {
              some: {
                branchId: dto.branchId,
                role: StaffRole.GROOMER,
                active: true,
              },
            },
          },
          select: {
            id: true,
            displayName: true,
            groomerServiceSkills: {
              where: {
                active: true,
                species: quote.pet.species,
                serviceId: { in: dto.serviceIds },
              },
              select: { serviceId: true },
            },
          },
          orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
        });

        if (dto.groomerId && candidates.length === 0) {
          throw new NotFoundException('Active branch groomer not found');
        }

        const eligibleGroomers = candidates.filter((groomer) => {
          const skills = new Set(
            groomer.groomerServiceSkills.map((skill) => skill.serviceId),
          );

          return dto.serviceIds.every((serviceId) => skills.has(serviceId));
        });

        const baseResponse = {
          date: dto.date,
          timezone: branch.timezone,
          evaluatedAt: now,
          slotIntervalMinutes: SLOT_INTERVAL_MINUTES,
          bufferMinutes: BUFFER_MINUTES,
          quote,
        };

        if (quote.requiresAssessment) {
          return {
            ...baseResponse,
            reason: 'ASSESSMENT_REQUIRED',
            groomers: [] as GroomerAvailability[],
          };
        }

        if (eligibleGroomers.length === 0) {
          return {
            ...baseResponse,
            reason: 'NO_ELIGIBLE_GROOMERS',
            groomers: [] as GroomerAvailability[],
          };
        }

        const groomerIds = eligibleGroomers.map((groomer) => groomer.id);

        const workingIntervals = await tx.groomerWorkingInterval.findMany({
          where: {
            branchId: dto.branchId,
            groomerId: { in: groomerIds },
            weekday,
          },
          select: {
            groomerId: true,
            startMinute: true,
            endMinute: true,
          },
        });

        // No branch filter: a groomer's time off applies across branches.
        const timeOffs = await tx.groomerTimeOff.findMany({
          where: {
            groomerId: { in: groomerIds },
            startsAt: { lt: dayEnd },
            endsAt: { gt: dayStart },
          },
          select: {
            groomerId: true,
            startsAt: true,
            endsAt: true,
          },
        });

        const closures = await tx.branchClosure.findMany({
          where: {
            branchId: dto.branchId,
            startsAt: { lt: dayEnd },
            endsAt: { gt: dayStart },
          },
          select: {
            startsAt: true,
            endsAt: true,
          },
        });

        const groomers: GroomerAvailability[] = eligibleGroomers.map(
          (groomer) => {
            const working = workingIntervals
              .filter((interval) => interval.groomerId === groomer.id)
              .map((interval) => ({
                startsAt: new Date(
                  dayStart.getTime() + interval.startMinute * MINUTE_MS,
                ),
                endsAt: new Date(
                  dayStart.getTime() + interval.endMinute * MINUTE_MS,
                ),
              }));

            const blocked = [
              ...closures,
              ...timeOffs.filter((timeOff) => timeOff.groomerId === groomer.id),
            ];

            const slots = calculateAvailableSlots({
              now,
              serviceDurationMinutes: quote.totalDurationMinutes,
              workingIntervals: working,
              blockedIntervals: blocked,
            });

            return {
              id: groomer.id,
              displayName: groomer.displayName,
              slots,
            };
          },
        );

        return {
          ...baseResponse,
          reason: groomers.some((groomer) => groomer.slots.length > 0)
            ? 'AVAILABLE'
            : 'NO_AVAILABLE_SLOTS',
          groomers,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
  }
}
