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

  it('[TC-AUTHZ-001] allows an active manager in their assigned branch', async () => {
    await expect(
      authorization.requireBranchRole(
        userId,
        branchAId,
        StaffRole.BRANCH_MANAGER,
      ),
    ).resolves.toBeUndefined();
  });

  it('[TC-AUTHZ-002] rejects access to another branch', async () => {
    await expect(
      authorization.requireBranchRole(
        userId,
        branchBId,
        StaffRole.BRANCH_MANAGER,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('[TC-AUTHZ-003] rejects a role the user does not hold', async () => {
    await expect(
      authorization.requireBranchRole(userId, branchAId, StaffRole.GROOMER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('[TC-AUTHZ-004] rejects a user without an assignment', async () => {
    await expect(
      authorization.requireBranchRole(
        randomUUID(),
        branchAId,
        StaffRole.BRANCH_MANAGER,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('[TC-AUTHZ-005] rejects an inactive assignment', async () => {
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

  it('[TC-AUTHZ-006] rejects an inactive user', async () => {
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

  it('[TC-AUTHZ-007] rejects an inactive branch', async () => {
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

  it('[TC-AUTHZ-008] rejects an inactive business unit', async () => {
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

  it('[TC-AUTHZ-009] returns 401 when accessing a manager route without a session', async () => {
    await request(app.getHttpServer())
      .get(`/test/branches/${branchAId}/manager`)
      .expect(401);
  });

  it('[TC-AUTHZ-010] allows a logged-in manager in their branch and rejects another branch', async () => {
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

  it('[TC-AUTHZ-030] isolates account data and branch access between two authenticated users', async () => {
    const managerAgent = request.agent(app.getHttpServer());
    const customerAgent = request.agent(app.getHttpServer());

    const customerEmail = `e2e-isolation-${randomUUID()}@example.com`;
    const password = 'PetopiaTest2026!';

    try {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: customerEmail,
          password,
          displayName: 'Isolation Customer',
        })
        .expect(201);

      const customer = await prisma.user.findUniqueOrThrow({
        where: { email: customerEmail },
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      });

      await managerAgent
        .post('/auth/login')
        .send({
          email: `e2e-authorization-${runId}@example.com`,
          password,
        })
        .expect(200);

      await customerAgent
        .post('/auth/login')
        .send({ email: customerEmail, password })
        .expect(200);

      await managerAgent
        .get('/auth/me')
        .expect(200)
        .expect({
          id: userId,
          email: `e2e-authorization-${runId}@example.com`,
          displayName: 'Authorization Test',
          staffAssignments: [
            {
              role: StaffRole.BRANCH_MANAGER,
              branch: {
                id: branchAId,
                code: `QA-A-${runId}`,
                name: 'Test Branch A',
              },
            },
          ],
          permissionGrants: [],
        });

      await customerAgent
        .get('/auth/me')
        .expect(200)
        .expect({
          ...customer,
          staffAssignments: [],
          permissionGrants: [],
        });

      for (const workspace of ['manager', 'groomer', 'payment']) {
        await customerAgent
          .get(`/branches/${branchAId}/workspaces/${workspace}`)
          .expect(403);
      }

      await customerAgent.post('/auth/logout').expect(204);
      await customerAgent.get('/auth/me').expect(401);

      // Logging out the customer must not invalidate the manager's session.
      await managerAgent
        .get(`/branches/${branchAId}/workspaces/manager`)
        .expect(200)
        .expect({
          workspace: 'manager',
          branch: {
            id: branchAId,
            code: `QA-A-${runId}`,
            name: 'Test Branch A',
          },
        });
    } finally {
      try {
        await managerAgent.post('/auth/logout').expect(204);
      } finally {
        const customer = await prisma.user.findUnique({
          where: { email: customerEmail },
          select: { id: true },
        });

        if (customer) {
          await prisma.session.deleteMany({
            where: {
              sess: {
                path: ['userId'],
                equals: customer.id,
              },
            },
          });

          await prisma.user.delete({
            where: { id: customer.id },
          });
        }
      }
    }
  });

  describe('current-user access', () => {
    const expectedAssignment = {
      role: StaffRole.BRANCH_MANAGER,
      branch: {
        id: branchAId,
        code: `QA-A-${runId}`,
        name: 'Test Branch A',
      },
    };

    const expectedGrant = {
      permission: StaffPermission.RECEIVE_PAYMENT,
      branch: {
        id: branchBId,
        code: `QA-B-${runId}`,
        name: 'Test Branch B',
      },
    };

    it('[TC-AUTHZ-019] returns public account fields and active branch access', async () => {
      const agent = request.agent(app.getHttpServer());

      const grant = await prisma.permissionGrant.create({
        data: {
          userId,
          branchId: branchBId,
          permission: StaffPermission.RECEIVE_PAYMENT,
        },
      });

      try {
        await agent
          .post('/auth/login')
          .send({
            email: `e2e-authorization-${runId}@example.com`,
            password: 'PetopiaTest2026!',
          })
          .expect(200);

        await agent
          .get('/auth/me')
          .expect(200)
          .expect('Cache-Control', 'no-store')
          .expect({
            id: userId,
            email: `e2e-authorization-${runId}@example.com`,
            displayName: 'Authorization Test',
            staffAssignments: [expectedAssignment],
            permissionGrants: [expectedGrant],
          });
      } finally {
        try {
          await agent.post('/auth/logout').expect(204);
        } finally {
          await prisma.permissionGrant.deleteMany({
            where: { id: grant.id },
          });
        }
      }
    });

    it.each([
      { caseId: 'TC-AUTHZ-020', target: 'assignment' },
      { caseId: 'TC-AUTHZ-021', target: 'grant' },
      { caseId: 'TC-AUTHZ-022', target: 'branch' },
      { caseId: 'TC-AUTHZ-023', target: 'business' },
    ] as const)(
      '[$caseId] updates current-user access when $target becomes inactive',
      async ({ target }) => {
        const agent = request.agent(app.getHttpServer());

        const grant = await prisma.permissionGrant.create({
          data: {
            userId,
            branchId: branchBId,
            permission: StaffPermission.RECEIVE_PAYMENT,
          },
        });

        async function setActive(active: boolean) {
          if (target === 'assignment') {
            await prisma.staffAssignment.update({
              where: { id: assignmentId },
              data: { active },
            });
          } else if (target === 'grant') {
            await prisma.permissionGrant.update({
              where: { id: grant.id },
              data: { active },
            });
          } else if (target === 'branch') {
            await prisma.branch.updateMany({
              where: { id: { in: [branchAId, branchBId] } },
              data: { active },
            });
          } else {
            await prisma.businessUnit.update({
              where: { id: businessUnitId },
              data: { active },
            });
          }
        }

        try {
          await agent
            .post('/auth/login')
            .send({
              email: `e2e-authorization-${runId}@example.com`,
              password: 'PetopiaTest2026!',
            })
            .expect(200);

          const publicUser = {
            id: userId,
            email: `e2e-authorization-${runId}@example.com`,
            displayName: 'Authorization Test',
          };

          await agent
            .get('/auth/me')
            .expect(200)
            .expect({
              ...publicUser,
              staffAssignments: [expectedAssignment],
              permissionGrants: [expectedGrant],
            });

          await setActive(false);

          await agent
            .get('/auth/me')
            .expect(200)
            .expect({
              ...publicUser,
              staffAssignments: target === 'grant' ? [expectedAssignment] : [],
              permissionGrants: target === 'assignment' ? [expectedGrant] : [],
            });
        } finally {
          try {
            await setActive(true);
          } finally {
            try {
              await agent.post('/auth/logout').expect(204);
            } finally {
              await prisma.permissionGrant.deleteMany({
                where: { id: grant.id },
              });
            }
          }
        }
      },
    );
  });

  describe('branch workspaces', () => {
    const credentials = {
      email: `e2e-authorization-${runId}@example.com`,
      password: 'PetopiaTest2026!',
    };

    const branchA = {
      id: branchAId,
      code: `QA-A-${runId}`,
      name: 'Test Branch A',
    };

    const branchB = {
      id: branchBId,
      code: `QA-B-${runId}`,
      name: 'Test Branch B',
    };

    it.each([
      { caseId: 'TC-AUTHZ-024', workspace: 'manager' },
      { caseId: 'TC-AUTHZ-025', workspace: 'groomer' },
      { caseId: 'TC-AUTHZ-026', workspace: 'payment' },
    ])(
      '[$caseId] rejects the $workspace workspace without a session',
      async ({ workspace }) => {
        await request(app.getHttpServer())
          .get(`/branches/${branchAId}/workspaces/${workspace}`)
          .expect(401);
      },
    );

    it('[TC-AUTHZ-027] allows manager and payment workspaces only in the assigned branch', async () => {
      const agent = request.agent(app.getHttpServer());

      try {
        await agent.post('/auth/login').send(credentials).expect(200);

        for (const workspace of ['manager', 'payment']) {
          await agent
            .get(`/branches/${branchAId}/workspaces/${workspace}`)
            .expect(200)
            .expect('Cache-Control', 'no-store')
            .expect({ workspace, branch: branchA });

          await agent
            .get(`/branches/${branchBId}/workspaces/${workspace}`)
            .expect(403);
        }

        await agent
          .get(`/branches/${branchAId}/workspaces/groomer`)
          .expect(403);
      } finally {
        await agent.post('/auth/logout').expect(204);
      }
    });

    it('[TC-AUTHZ-028] allows a groomer only in their assigned branch and removes access after revocation', async () => {
      const agent = request.agent(app.getHttpServer());
      const groomerAssignmentId = randomUUID();

      try {
        await prisma.staffAssignment.create({
          data: {
            id: groomerAssignmentId,
            userId,
            branchId: branchBId,
            role: StaffRole.GROOMER,
          },
        });

        await agent.post('/auth/login').send(credentials).expect(200);

        await agent
          .get(`/branches/${branchBId}/workspaces/groomer`)
          .expect(200)
          .expect('Cache-Control', 'no-store')
          .expect({ workspace: 'groomer', branch: branchB });

        await agent
          .get(`/branches/${branchAId}/workspaces/groomer`)
          .expect(403);

        await agent
          .get(`/branches/${branchBId}/workspaces/manager`)
          .expect(403);

        await agent
          .get(`/branches/${branchBId}/workspaces/payment`)
          .expect(403);

        await prisma.staffAssignment.update({
          where: { id: groomerAssignmentId },
          data: { active: false },
        });

        await agent
          .get(`/branches/${branchBId}/workspaces/groomer`)
          .expect(403);
      } finally {
        try {
          await agent.post('/auth/logout').expect(204);
        } finally {
          await prisma.staffAssignment.deleteMany({
            where: { id: groomerAssignmentId },
          });
        }
      }
    });

    it('[TC-AUTHZ-029] allows an explicit payment grant without granting manager or groomer access', async () => {
      const agent = request.agent(app.getHttpServer());
      const grantId = randomUUID();

      try {
        await prisma.permissionGrant.create({
          data: {
            id: grantId,
            userId,
            branchId: branchBId,
            permission: StaffPermission.RECEIVE_PAYMENT,
          },
        });

        await agent.post('/auth/login').send(credentials).expect(200);

        await agent
          .get(`/branches/${branchBId}/workspaces/payment`)
          .expect(200)
          .expect('Cache-Control', 'no-store')
          .expect({ workspace: 'payment', branch: branchB });

        for (const workspace of ['manager', 'groomer']) {
          await agent
            .get(`/branches/${branchBId}/workspaces/${workspace}`)
            .expect(403);
        }

        await prisma.permissionGrant.update({
          where: { id: grantId },
          data: { active: false },
        });

        await agent
          .get(`/branches/${branchBId}/workspaces/payment`)
          .expect(403);
      } finally {
        try {
          await agent.post('/auth/logout').expect(204);
        } finally {
          await prisma.permissionGrant.deleteMany({
            where: { id: grantId },
          });
        }
      }
    });
  });

  describe('receive payment', () => {
    afterEach(async () => {
      if (prisma) {
        await prisma.permissionGrant.deleteMany({
          where: { userId },
        });
      }
    });

    it('[TC-AUTHZ-011]allows a branch manager without an explicit payment grant', async () => {
      await expect(
        authorization.requireReceivePayment(userId, branchAId),
      ).resolves.toBeUndefined();
    });

    it('[TC-AUTHZ-012] rejects a manager requesting payment access in another branch', async () => {
      await expect(
        authorization.requireReceivePayment(userId, branchBId),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('[TC-AUTHZ-013]allows an active payment grant without a manager role in that branch', async () => {
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

    it('[TC-AUTHZ-014]rejects an inactive payment grant', async () => {
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

    it.each([
      { caseId: 'TC-AUTHZ-015', target: 'user' },
      { caseId: 'TC-AUTHZ-016', target: 'branch' },
      { caseId: 'TC-AUTHZ-017', target: 'business' },
    ] as const)(
      '[$caseId] rejects a payment grant when its $target is inactive',
      async ({ target }) => {
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

    it('[TC-AUTHZ-018] allows payment access with a grant without allowing manager access', async () => {
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
