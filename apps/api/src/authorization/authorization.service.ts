import { ForbiddenException, Injectable } from '@nestjs/common';
import { StaffPermission, StaffRole } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthorizationService {
  constructor(private readonly prismaService: PrismaService) {}

  async requireBranchRole(
    userId: string,
    branchId: string,
    role: StaffRole,
  ): Promise<void> {
    const assignment = await this.prismaService.staffAssignment.findFirst({
      where: {
        userId,
        branchId,
        role,
        active: true,
        user: {
          active: true,
        },
        branch: {
          active: true,
          businessUnit: {
            active: true,
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (!assignment) {
      throw new ForbiddenException('Insufficient branch permissions');
    }
  }
  async requireReceivePayment(userId: string, branchId: string): Promise<void> {
    const user = await this.prismaService.user.findFirst({
      where: {
        id: userId,
        active: true,
        OR: [
          {
            staffAssignments: {
              some: {
                branchId,
                role: StaffRole.BRANCH_MANAGER,
                active: true,
                branch: {
                  active: true,
                  businessUnit: {
                    active: true,
                  },
                },
              },
            },
          },
          {
            permissionGrants: {
              some: {
                branchId,
                permission: StaffPermission.RECEIVE_PAYMENT,
                active: true,
                branch: {
                  active: true,
                  businessUnit: {
                    active: true,
                  },
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new ForbiddenException('Insufficient branch permissions');
    }
  }
}
