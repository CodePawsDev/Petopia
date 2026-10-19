import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';

@Injectable()
export class PetsService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(ownerId: string, dto: CreatePetDto) {
    let birthDate: Date | null = null;

    if (dto.birthDate != null) {
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());

      birthDate = new Date(`${dto.birthDate}T00:00:00.000Z`);

      if (
        Number.isNaN(birthDate.getTime()) ||
        birthDate.toISOString().slice(0, 10) !== dto.birthDate
      ) {
        throw new BadRequestException('Invalid birth date');
      }

      if (dto.birthDate > today) {
        throw new BadRequestException('Birth date cannot be in the future');
      }
    }

    const pet = await this.prismaService.pet.create({
      data: {
        ownerId,
        name: dto.name,
        species: dto.species,
        breed: dto.breed || null,
        birthDate,
        weightKg: dto.weightKg ?? null,
        careNotes: dto.careNotes || null,
      },
      select: {
        id: true,
        name: true,
        species: true,
        breed: true,
        birthDate: true,
        weightKg: true,
        careNotes: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      ...pet,
      birthDate: pet.birthDate?.toISOString().slice(0, 10) ?? null,
      weightKg: pet.weightKg?.toNumber() ?? null,
    };
  }

  async findAll(ownerId: string, archived = false) {
    const pets = await this.prismaService.pet.findMany({
      where: {
        ownerId,
        archivedAt: archived ? { not: null } : null,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        species: true,
        breed: true,
        birthDate: true,
        weightKg: true,
        careNotes: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return pets.map((pet) => ({
      ...pet,
      birthDate: pet.birthDate?.toISOString().slice(0, 10) ?? null,
      weightKg: pet.weightKg?.toNumber() ?? null,
    }));
  }

  async findOne(ownerId: string, petId: string) {
    const pet = await this.prismaService.pet.findFirst({
      where: {
        id: petId,
        ownerId,
      },
      select: {
        id: true,
        name: true,
        species: true,
        breed: true,
        birthDate: true,
        weightKg: true,
        careNotes: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!pet) {
      throw new NotFoundException('Pet not found');
    }

    return {
      ...pet,
      birthDate: pet.birthDate?.toISOString().slice(0, 10) ?? null,
      weightKg: pet.weightKg?.toNumber() ?? null,
    };
  }
  async archive(ownerId: string, petId: string) {
    await this.prismaService.pet.updateMany({
      where: {
        id: petId,
        ownerId,
        archivedAt: null,
      },
      data: {
        archivedAt: new Date(),
      },
    });

    return this.findOne(ownerId, petId);
  }

  async restore(ownerId: string, petId: string) {
    await this.prismaService.pet.updateMany({
      where: {
        id: petId,
        ownerId,
        archivedAt: { not: null },
      },
      data: {
        archivedAt: null,
      },
    });

    return this.findOne(ownerId, petId);
  }
  async update(ownerId: string, petId: string, dto: UpdatePetDto) {
    await this.findOne(ownerId, petId);

    let birthDate: Date | null | undefined;

    if (dto.birthDate === null) {
      birthDate = null;
    } else if (dto.birthDate !== undefined) {
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());

      birthDate = new Date(`${dto.birthDate}T00:00:00.000Z`);

      if (
        Number.isNaN(birthDate.getTime()) ||
        birthDate.toISOString().slice(0, 10) !== dto.birthDate
      ) {
        throw new BadRequestException('Invalid birth date');
      }

      if (dto.birthDate > today) {
        throw new BadRequestException('Birth date cannot be in the future');
      }
    }

    await this.prismaService.pet.updateMany({
      where: {
        id: petId,
        ownerId,
      },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.species !== undefined && { species: dto.species }),
        ...(dto.breed !== undefined && {
          breed: dto.breed || null,
        }),
        ...(birthDate !== undefined && { birthDate }),
        ...(dto.weightKg !== undefined && {
          weightKg: dto.weightKg,
        }),
        ...(dto.careNotes !== undefined && {
          careNotes: dto.careNotes || null,
        }),
      },
    });

    return this.findOne(ownerId, petId);
  }
}
