import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GroomingBookingStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchClosureDto } from './dto/create-branch-closure.dto';

const closureSelect = {
  id: true,
  startsAt: true,
  endsAt: true,
  reason: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BranchClosureSelect;

@Injectable()
export class BranchClosuresService {
  constructor(private readonly prismaService: PrismaService) {}

  private async requireBranch(
    tx: Prisma.TransactionClient,
    branchId: string,
  ): Promise<void> {
    const branch = await tx.branch.findFirst({
      where: {
        id: branchId,
        active: true,
        businessUnit: {
          active: true,
          code: 'GROOMING',
        },
      },
      select: {
        id: true,
        timezone: true,
      },
    });

    if (!branch) {
      throw new NotFoundException('Active grooming branch not found');
    }

    if (branch.timezone !== 'Asia/Bangkok') {
      throw new BadRequestException(
        'Branch closures currently support Asia/Bangkok only',
      );
    }
  }

  private async lockBranch(
    tx: Prisma.TransactionClient,
    branchId: string,
  ): Promise<void> {
    const branches = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "branches"
        WHERE "id" = ${branchId}::uuid
        FOR UPDATE
      `;

    if (branches.length === 0) {
      throw new NotFoundException('Active grooming branch not found');
    }
  }

  async findAll(branchId: string) {
    return this.prismaService.$transaction(
      async (tx) => {
        await this.requireBranch(tx, branchId);

        return tx.branchClosure.findMany({
          where: { branchId },
          orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
          select: closureSelect,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
  }

  async create(branchId: string, dto: CreateBranchClosureDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    if (
      !Number.isFinite(startsAt.getTime()) ||
      !Number.isFinite(endsAt.getTime()) ||
      startsAt.getTime() >= endsAt.getTime()
    ) {
      throw new BadRequestException('Branch closure must start before it ends');
    }

    return this.prismaService.$transaction(
      async (tx) => {
        await this.lockBranch(tx, branchId);
        await this.requireBranch(tx, branchId);

        // Check after acquiring the lock so a booking committed while
        // this request was waiting is visible under ReadCommitted.
        const now = new Date();
        const overlapStart = new Date(
          Math.max(startsAt.getTime(), now.getTime()),
        );

        const conflictingBooking = await tx.groomingBooking.findFirst({
          where: {
            branchId,
            status: GroomingBookingStatus.CONFIRMED,
            startsAt: { lt: endsAt },
            occupiedEndsAt: { gt: overlapStart },
          },
          select: { id: true },
        });

        if (conflictingBooking) {
          throw new ConflictException(
            'Branch closure conflicts with an existing confirmed booking including its buffer',
          );
        }

        const closure = await tx.branchClosure.create({
          data: {
            branchId,
            startsAt,
            endsAt,
            reason: dto.reason?.trim() || null,
          },
          select: closureSelect,
        });

        await tx.branch.update({
          where: { id: branchId },
          data: {
            scheduleVersion: { increment: 1 },
          },
        });

        return closure;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000,
        timeout: 15_000,
      },
    );
  }

  async remove(branchId: string, closureId: string): Promise<void> {
    await this.prismaService.$transaction(
      async (tx) => {
        await this.lockBranch(tx, branchId);
        await this.requireBranch(tx, branchId);

        const removed = await tx.branchClosure.deleteMany({
          where: {
            id: closureId,
            branchId,
          },
        });

        if (removed.count === 0) {
          throw new NotFoundException('Branch closure not found');
        }

        await tx.branch.update({
          where: { id: branchId },
          data: {
            scheduleVersion: { increment: 1 },
          },
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
