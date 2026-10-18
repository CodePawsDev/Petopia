import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prismaService: PrismaService) {}

  async register(dto: RegisterDto) {
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    try {
      return await this.prismaService.user.create({
        data: {
          email: dto.email,
          passwordHash,
          displayName: dto.displayName,
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          createdAt: true,
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already registered');
      }

      throw error;
    }
  }

  async validateCredentials(dto: LoginDto) {
    const user = await this.prismaService.user.findUnique({
      where: {
        email: dto.email,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        passwordHash: true,
        active: true,
        authVersion: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    if (!passwordMatches || !user.active) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      authVersion: user.authVersion,
    };
  }

  async getSessionUser(
    userId: string | undefined,
    authVersion: number | undefined,
  ) {
    if (!userId || authVersion === undefined) {
      throw new UnauthorizedException('Authentication required');
    }

    const user = await this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        active: true,
        authVersion: true,
      },
    });

    if (!user || !user.active || user.authVersion !== authVersion) {
      throw new UnauthorizedException('Authentication required');
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    };
  }
  async getCurrentUserAccess(userId: string, authVersion: number | undefined) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        active: true,
        authVersion: true,
        staffAssignments: {
          where: {
            active: true,
            branch: {
              active: true,
              businessUnit: { active: true },
            },
          },
          orderBy: [{ branchId: 'asc' }, { role: 'asc' }],
          select: {
            role: true,
            branch: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        permissionGrants: {
          where: {
            active: true,
            branch: {
              active: true,
              businessUnit: { active: true },
            },
          },
          orderBy: [{ branchId: 'asc' }, { permission: 'asc' }],
          select: {
            permission: true,
            branch: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.active || user.authVersion !== authVersion) {
      throw new UnauthorizedException('Authentication required');
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      staffAssignments: user.staffAssignments,
      permissionGrants: user.permissionGrants,
    };
  }
}
