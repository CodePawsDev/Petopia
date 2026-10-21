import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StaffRole } from '../generated/prisma/client';

@Injectable()
export class CatalogService {
  constructor(private readonly prismaService: PrismaService) {}

  async findBranches() {
    return this.prismaService.branch.findMany({
      where: {
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
      orderBy: {
        code: 'asc',
      },
    });
  }

  async findBranchServices(branchId: string) {
    const branch = await this.prismaService.branch.findFirst({
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
        businessUnitId: true,
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const services = await this.prismaService.groomingService.findMany({
      where: {
        businessUnitId: branch.businessUnitId,
        active: true,
        rates: {
          some: {
            active: true,
          },
        },
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        kind: true,
        rates: {
          where: {
            active: true,
          },
          select: {
            id: true,
            species: true,
            minWeightKg: true,
            maxWeightKg: true,
            priceSatang: true,
            durationMinutes: true,
            requiresAssessment: true,
          },
          orderBy: [
            { species: 'asc' },
            { minWeightKg: 'asc' },
            { maxWeightKg: 'asc' },
          ],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });

    return {
      branch: {
        id: branch.id,
        code: branch.code,
        name: branch.name,
      },
      currency: 'THB',
      services: services.map((service) => ({
        ...service,
        rates: service.rates.map((rate) => ({
          ...rate,
          minWeightKg: rate.minWeightKg.toNumber(),
          maxWeightKg: rate.maxWeightKg.toNumber(),
        })),
      })),
    };
  }

  async findBranchGroomers(branchId: string) {
    const branch = await this.prismaService.branch.findFirst({
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
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const assignments = await this.prismaService.staffAssignment.findMany({
      where: {
        branchId: branch.id,
        role: StaffRole.GROOMER,
        active: true,
        user: {
          active: true,
        },
      },
      select: {
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
      orderBy: [{ user: { displayName: 'asc' } }, { userId: 'asc' }],
    });

    return {
      branch,
      groomers: assignments.map((assignment) => assignment.user),
    };
  }
}
