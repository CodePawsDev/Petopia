import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GroomingServiceKind, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuoteDto } from './dto/create-quote.dto';

@Injectable()
export class QuotesService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(ownerId: string, dto: CreateQuoteDto) {
    return this.prismaService.$transaction(
      (tx) => this.calculateInTransaction(tx, ownerId, dto),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
    );
  }

  async calculateInTransaction(
    tx: Prisma.TransactionClient,
    ownerId: string,
    dto: CreateQuoteDto,
  ) {
    const branch = await tx.branch.findFirst({
      where: {
        id: dto.branchId,
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

    const pet = await tx.pet.findFirst({
      where: {
        id: dto.petId,
        ownerId,
        archivedAt: null,
      },
      select: {
        id: true,
        name: true,
        species: true,
        weightKg: true,
      },
    });

    if (!pet) {
      throw new NotFoundException('Pet not found');
    }

    const weightKg = pet.weightKg;

    if (
      weightKg === null ||
      !weightKg.isFinite() ||
      weightKg.lessThanOrEqualTo(0)
    ) {
      throw new BadRequestException(
        'Pet weight is required to calculate a quote',
      );
    }

    const services = await tx.groomingService.findMany({
      where: {
        id: { in: dto.serviceIds },
        businessUnitId: branch.businessUnitId,
        active: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        kind: true,
        rates: {
          where: {
            active: true,
            species: pet.species,
            minWeightKg: { lt: weightKg },
            maxWeightKg: { gte: weightKg },
          },
          select: {
            id: true,
            priceSatang: true,
            durationMinutes: true,
            requiresAssessment: true,
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });

    if (services.length !== dto.serviceIds.length) {
      throw new BadRequestException(
        'One or more selected services are unavailable',
      );
    }

    const kinds = new Set(services.map((service) => service.kind));

    if (
      kinds.has(GroomingServiceKind.BATH) &&
      kinds.has(GroomingServiceKind.BATH_WITH_HAIRCUT)
    ) {
      throw new BadRequestException(
        'Bath and bath with haircut cannot be selected together',
      );
    }

    const items = services.map((service) => {
      if (service.rates.length !== 1) {
        throw new BadRequestException(
          'A selected service has no unique rate for this pet; contact the branch for assessment',
        );
      }

      const rate = service.rates[0];

      return {
        serviceId: service.id,
        rateId: rate.id,
        code: service.code,
        name: service.name,
        kind: service.kind,
        priceSatang: rate.priceSatang,
        durationMinutes: rate.durationMinutes,
        requiresAssessment: rate.requiresAssessment,
      };
    });

    const totalPriceSatang = items.reduce(
      (total, item) => total + item.priceSatang,
      0,
    );

    const totalDurationMinutes = items.reduce(
      (total, item) => total + item.durationMinutes,
      0,
    );

    return {
      branch: {
        id: branch.id,
        code: branch.code,
        name: branch.name,
      },
      pet: {
        id: pet.id,
        name: pet.name,
        species: pet.species,
        weightKg: weightKg.toNumber(),
      },
      currency: 'THB',
      items,
      totalPriceSatang,
      totalDurationMinutes,
      requiresAssessment: items.some((item) => item.requiresAssessment),
    };
  }
}
