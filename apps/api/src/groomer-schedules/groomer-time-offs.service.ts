import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StaffRole } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTimeOffDto } from './dto/create-time-off.dto';

const timeOffSelect = {
  id: true,
  startsAt: true,
  endsAt: true,
  reason: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.GroomerTimeOffSelect;

@Injectable()
export class GroomerTimeOffsService {
  constructor(private readonly prismaService: PrismaService) {}

  private async requireGroomer(
    tx: Prisma.TransactionClient,
    branchId: string,
    groomerId: string,
  ) {
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
        id: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Active branch groomer not found');
    }
  }

  private async lockGroomer(
    tx: Prisma.TransactionClient,
    groomerId: string,
  ): Promise<void> {
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
  }

  async findAll(branchId: string, groomerId: string) {
    return this.prismaService.$transaction(async (tx) => {
      await this.requireGroomer(tx, branchId, groomerId);

      return tx.groomerTimeOff.findMany({
        where: {
          branchId,
          groomerId,
        },
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        select: timeOffSelect,
      });
    });
  }

  async create(branchId: string, groomerId: string, dto: CreateTimeOffDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      startsAt.getTime() >= endsAt.getTime()
    ) {
      throw new BadRequestException('Time off must start before it ends');
    }

    return this.prismaService.$transaction(async (tx) => {
      await this.lockGroomer(tx, groomerId);
      await this.requireGroomer(tx, branchId, groomerId);

      const timeOff = await tx.groomerTimeOff.create({
        data: {
          branchId,
          groomerId,
          startsAt,
          endsAt,
          reason: dto.reason?.trim() || null,
        },
        select: timeOffSelect,
      });

      await tx.branch.update({
        where: {
          id: branchId,
        },
        data: {
          scheduleVersion: {
            increment: 1,
          },
        },
      });

      return timeOff;
    });
  }

  async remove(
    branchId: string,
    groomerId: string,
    timeOffId: string,
  ): Promise<void> {
    await this.prismaService.$transaction(async (tx) => {
      await this.lockGroomer(tx, groomerId);
      await this.requireGroomer(tx, branchId, groomerId);

      const result = await tx.groomerTimeOff.deleteMany({
        where: {
          id: timeOffId,
          branchId,
          groomerId,
        },
      });

      if (result.count === 0) {
        throw new NotFoundException('Time off not found');
      }

      await tx.branch.update({
        where: {
          id: branchId,
        },
        data: {
          scheduleVersion: {
            increment: 1,
          },
        },
      });
    });
  }
}
