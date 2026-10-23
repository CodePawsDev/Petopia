import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GroomingBookingStatus,
  Prisma,
  StaffRole,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReplaceWeeklyScheduleDto } from './dto/replace-weekly-schedule.dto';

@Injectable()
export class GroomerSchedulesService {
  constructor(private readonly prismaService: PrismaService) {}

  async getWeeklySchedule(branchId: string, groomerId: string) {
    const assignment = await this.prismaService.staffAssignment.findFirst({
      where: {
        branchId,
        userId: groomerId,
        role: StaffRole.GROOMER,
        active: true,
        user: {
          active: true,
        },
        branch: {
          active: true,
          timezone: 'Asia/Bangkok',
          businessUnit: {
            active: true,
            code: 'GROOMING',
          },
        },
      },
      select: {
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
        branch: {
          select: {
            id: true,
            code: true,
            name: true,
            timezone: true,
            scheduleVersion: true,
          },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Active branch groomer not found');
    }

    const intervals = await this.prismaService.groomerWorkingInterval.findMany({
      where: {
        branchId,
        groomerId,
      },
      orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        weekday: true,
        startMinute: true,
        endMinute: true,
      },
    });

    return {
      branch: assignment.branch,
      groomer: assignment.user,
      intervals,
    };
  }

  async replaceWeeklySchedule(
    branchId: string,
    groomerId: string,
    dto: ReplaceWeeklyScheduleDto,
  ) {
    const intervals = [...dto.intervals].sort(
      (a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute,
    );

    for (let index = 0; index < intervals.length; index += 1) {
      const interval = intervals[index];

      if (interval.startMinute >= interval.endMinute) {
        throw new BadRequestException(
          'Working interval must start before it ends',
        );
      }

      const previous = intervals[index - 1];

      if (
        previous &&
        previous.weekday === interval.weekday &&
        interval.startMinute < previous.endMinute
      ) {
        throw new BadRequestException('Working intervals must not overlap');
      }
    }

    return this.prismaService.$transaction(async (tx) => {
      // Serialize schedule changes for this groomer across branches.
      const groomers = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
          SELECT "id"
          FROM "users"
          WHERE "id" = ${groomerId}::uuid
          FOR UPDATE
        `,
      );

      if (groomers.length === 0) {
        throw new NotFoundException('Active branch groomer not found');
      }

      const assignment = await tx.staffAssignment.findFirst({
        where: {
          branchId,
          userId: groomerId,
          role: StaffRole.GROOMER,
          active: true,
          user: {
            active: true,
          },
          branch: {
            active: true,
            timezone: 'Asia/Bangkok',
            businessUnit: {
              active: true,
              code: 'GROOMING',
            },
          },
        },
        select: {
          user: {
            select: {
              id: true,
              displayName: true,
            },
          },
          branch: {
            select: {
              id: true,
              code: true,
              name: true,
              timezone: true,
            },
          },
        },
      });

      if (!assignment) {
        throw new NotFoundException('Active branch groomer not found');
      }

      const otherBranchIntervals = await tx.groomerWorkingInterval.findMany({
        where: {
          groomerId,
          branchId: {
            not: branchId,
          },
        },
        select: {
          weekday: true,
          startMinute: true,
          endMinute: true,
        },
      });

      const hasConflict = intervals.some((interval) =>
        otherBranchIntervals.some(
          (existing) =>
            existing.weekday === interval.weekday &&
            interval.startMinute < existing.endMinute &&
            existing.startMinute < interval.endMinute,
        ),
      );

      if (hasConflict) {
        throw new ConflictException(
          'Working intervals conflict with another branch schedule',
        );
      }

      // Protect upcoming and ongoing confirmed bookings in this branch.
      const bookings = await tx.groomingBooking.findMany({
        where: {
          branchId,
          groomerId,
          status: GroomingBookingStatus.CONFIRMED,
          occupiedEndsAt: { gt: new Date() },
        },
        select: {
          startsAt: true,
          occupiedEndsAt: true,
        },
      });

      const offsetMs = 7 * 60 * 60 * 1000;
      const minuteMs = 60_000;

      const invalidatesBooking = bookings.some((booking) => {
        const localStart = new Date(booking.startsAt.getTime() + offsetMs);
        const weekday = localStart.getUTCDay() || 7;
        const localDate = localStart.toISOString().slice(0, 10);
        const dayStartMs = new Date(`${localDate}T00:00:00+07:00`).getTime();

        return !intervals.some(
          (interval) =>
            interval.weekday === weekday &&
            dayStartMs + interval.startMinute * minuteMs <=
              booking.startsAt.getTime() &&
            booking.occupiedEndsAt.getTime() <=
              dayStartMs + interval.endMinute * minuteMs,
        );
      });

      if (invalidatesBooking) {
        throw new ConflictException(
          'Working intervals must preserve existing confirmed bookings including their buffer',
        );
      }

      await tx.groomerWorkingInterval.deleteMany({
        where: {
          branchId,
          groomerId,
        },
      });

      if (intervals.length > 0) {
        await tx.groomerWorkingInterval.createMany({
          data: intervals.map((interval) => ({
            branchId,
            groomerId,
            weekday: interval.weekday,
            startMinute: interval.startMinute,
            endMinute: interval.endMinute,
          })),
        });
      }

      const branch = await tx.branch.update({
        where: {
          id: branchId,
        },
        data: {
          scheduleVersion: {
            increment: 1,
          },
        },
        select: {
          scheduleVersion: true,
        },
      });

      const savedIntervals = await tx.groomerWorkingInterval.findMany({
        where: {
          branchId,
          groomerId,
        },
        orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          weekday: true,
          startMinute: true,
          endMinute: true,
        },
      });

      return {
        branch: {
          ...assignment.branch,
          scheduleVersion: branch.scheduleVersion,
        },
        groomer: assignment.user,
        intervals: savedIntervals,
      };
    });
  }
}
