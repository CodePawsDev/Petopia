import { ForbiddenException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { AuthorizationService } from '../src/authorization/authorization.service';
import { StaffPermission, StaffRole } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthModule } from '../src/auth/auth.module';
import { AuthorizationModule } from '../src/authorization/authorization.module';
import { AuthorizationTestController } from './helpers/authorization-test.controller';
import request from 'supertest';
import { setupApp } from '../src/setup-app';
import type { App } from 'supertest/types';
import * as argon2 from 'argon2';

describe('Branch authorization (database integration)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let authorization: AuthorizationService;

  const userId = randomUUID();
  const businessUnitId = randomUUID();
  const branchAId = randomUUID();
  const branchBId = randomUUID();
  const assignmentId = randomUUID();
  const runId = randomUUID();

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule, AuthModule, AuthorizationModule],
      controllers: [AuthorizationTestController],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    authorization = app.get(AuthorizationService);

    await prisma.user.create({
      data: {
        id: userId,
        email: `e2e-authorization-${runId}@example.com`,
        passwordHash: await argon2.hash('PetopiaTest2026!', {
          type: argon2.argon2id,
          memoryCost: 19456,
          timeCost: 2,
          parallelism: 1,
        }),
        displayName: 'Authorization Test',
      },
    });

    await prisma.businessUnit.create({
      data: {
        id: businessUnitId,
        code: `QA-${runId}`,
        name: 'Authorization Test Business',
      },
    });

    await prisma.branch.createMany({
      data: [
        {
          id: branchAId,
          businessUnitId,
          code: `QA-A-${runId}`,
          name: 'Test Branch A',
        },
        {
          id: branchBId,
          businessUnitId,
          code: `QA-B-${runId}`,
          name: 'Test Branch B',
        },
      ],
    });

    await prisma.staffAssignment.create({
      data: {
        id: assignmentId,
        userId,
        branchId: branchAId,
        role: StaffRole.BRANCH_MANAGER,
      },
    });
  });

  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.permissionGrant.deleteMany({
          where: { userId },
        });
        await prisma.staffAssignment.deleteMany({
          where: { userId },
        });
        await prisma.branch.deleteMany({
          where: { businessUnitId },
        });
        await prisma.businessUnit.deleteMany({
          where: { id: businessUnitId },
        });
        await prisma.user.deleteMany({
          where: { id: userId },
        });
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('allows an active manager in their assigned branch', async () => {
    await expect(
      authorization.requireBranchRole(
        userId,
        branchAId,
        StaffRole.BRANCH_MANAGER,
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects access to another branch', async () => {
    await expect(
      authorization.requireBranchRole(
        userId,
        branchBId,
        StaffRole.BRANCH_MANAGER,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a role the user does not hold', async () => {
    await expect(
      authorization.requireBranchRole(userId, branchAId, StaffRole.GROOMER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a user without an assignment', async () => {
    await expect(
      authorization.requireBranchRole(
        randomUUID(),
        branchAId,
        StaffRole.BRANCH_MANAGER,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an inactive assignment', async () => {
    try {
      await prisma.staffAssignment.update({
        where: { id: assignmentId },
        data: { active: false },
      });

      await expect(
        authorization.requireBranchRole(
          userId,
          branchAId,
          StaffRole.BRANCH_MANAGER,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    } finally {
      await prisma.staffAssignment.update({
        where: { id: assignmentId },
        data: { active: true },
      });
    }
  });

  it('rejects an inactive user', async () => {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { active: false },
      });

      await expect(
        authorization.requireBranchRole(
          userId,
          branchAId,
          StaffRole.BRANCH_MANAGER,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    } finally {
      await prisma.user.update({
        where: { id: userId },
        data: { active: true },
      });
    }
  });

  it('rejects an inactive branch', async () => {
    try {
      await prisma.branch.update({
        where: { id: branchAId },
        data: { active: false },
      });

      await expect(
        authorization.requireBranchRole(
          userId,
          branchAId,
          StaffRole.BRANCH_MANAGER,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    } finally {
      await prisma.branch.update({
        where: { id: branchAId },
        data: { active: true },
      });
    }
  });

  it('rejects an inactive business unit', async () => {
    try {
      await prisma.businessUnit.update({
        where: { id: businessUnitId },
        data: { active: false },
      });

      await expect(
        authorization.requireBranchRole(
          userId,
          branchAId,
          StaffRole.BRANCH_MANAGER,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    } finally {
      await prisma.businessUnit.update({
        where: { id: businessUnitId },
        data: { active: true },
      });
    }
  });

  it('returns 401 when accessing a manager route without a session', async () => {
    await request(app.getHttpServer())
      .get(`/test/branches/${branchAId}/manager`)
      .expect(401);
  });

  it('allows a logged-in manager in their branch and rejects another branch', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/login')
      .send({
        email: `e2e-authorization-${runId}@example.com`,
        password: 'PetopiaTest2026!',
      })
      .expect(200);

    try {
      await agent
        .get(`/test/branches/${branchAId}/manager`)
        .expect(200)
        .expect({ allowed: true });

      await agent.get(`/test/branches/${branchBId}/manager`).expect(403);
    } finally {
      await agent.post('/auth/logout').expect(204);
    }
  });

  describe('receive payment', () => {
    afterEach(async () => {
      if (prisma) {
        await prisma.permissionGrant.deleteMany({
          where: { userId },
        });
      }
    });

    it('allows a branch manager without an explicit payment grant', async () => {
      await expect(
        authorization.requireReceivePayment(userId, branchAId),
      ).resolves.toBeUndefined();
    });

    it('rejects a manager requesting payment access in another branch', async () => {
      await expect(
        authorization.requireReceivePayment(userId, branchBId),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows an active payment grant without a manager role in that branch', async () => {
      await prisma.permissionGrant.create({
        data: {
          userId,
          branchId: branchBId,
          permission: StaffPermission.RECEIVE_PAYMENT,
        },
      });

      await expect(
        authorization.requireReceivePayment(userId, branchBId),
      ).resolves.toBeUndefined();

      await expect(
        authorization.requireBranchRole(
          userId,
          branchBId,
          StaffRole.BRANCH_MANAGER,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects an inactive payment grant', async () => {
      await prisma.permissionGrant.create({
        data: {
          userId,
          branchId: branchBId,
          permission: StaffPermission.RECEIVE_PAYMENT,
          active: false,
        },
      });

      await expect(
        authorization.requireReceivePayment(userId, branchBId),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it.each(['user', 'branch', 'business'] as const)(
      'rejects a payment grant when its %s is inactive',
      async (target) => {
        await prisma.permissionGrant.create({
          data: {
            userId,
            branchId: branchBId,
            permission: StaffPermission.RECEIVE_PAYMENT,
          },
        });

        try {
          if (target === 'user') {
            await prisma.user.update({
              where: { id: userId },
              data: { active: false },
            });
          } else if (target === 'branch') {
            await prisma.branch.update({
              where: { id: branchBId },
              data: { active: false },
            });
          } else {
            await prisma.businessUnit.update({
              where: { id: businessUnitId },
              data: { active: false },
            });
          }

          await expect(
            authorization.requireReceivePayment(userId, branchBId),
          ).rejects.toBeInstanceOf(ForbiddenException);
        } finally {
          if (target === 'user') {
            await prisma.user.update({
              where: { id: userId },
              data: { active: true },
            });
          } else if (target === 'branch') {
            await prisma.branch.update({
              where: { id: branchBId },
              data: { active: true },
            });
          } else {
            await prisma.businessUnit.update({
              where: { id: businessUnitId },
              data: { active: true },
            });
          }
        }
      },
    );

    it('allows payment access with a grant without allowing manager access', async () => {
      const agent = request.agent(app.getHttpServer());

      await agent
        .post('/auth/login')
        .send({
          email: `e2e-authorization-${runId}@example.com`,
          password: 'PetopiaTest2026!',
        })
        .expect(200);

      try {
        await agent
          .get(`/test/branches/${branchBId}/receive-payment`)
          .expect(403);

        const grant = await prisma.permissionGrant.create({
          data: {
            userId,
            branchId: branchBId,
            permission: StaffPermission.RECEIVE_PAYMENT,
          },
        });

        await agent
          .get(`/test/branches/${branchBId}/receive-payment`)
          .expect(200)
          .expect({ allowed: true });

        await agent.get(`/test/branches/${branchBId}/manager`).expect(403);

        await prisma.permissionGrant.update({
          where: { id: grant.id },
          data: { active: false },
        });

        await agent
          .get(`/test/branches/${branchBId}/receive-payment`)
          .expect(403);
      } finally {
        await agent.post('/auth/logout').expect(204);
      }
    });
  });
});
