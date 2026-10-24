import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  GroomingBookingStatus,
  PetSpecies,
  StaffPermission,
  StaffRole,
} from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';

function readRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected an object');
  }

  return value as Record<string, unknown>;
}

function readItems(value: unknown): Record<string, unknown>[] {
  const body = readRecord(value);

  if (!Array.isArray(body.items)) {
    throw new Error('Expected booking items');
  }

  return body.items.map((item: unknown) => readRecord(item));
}

describe('Branch bookings (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const agents = new Map<string, ReturnType<typeof request.agent>>();
  const runId = randomUUID();
  const branchId = randomUUID();
  const otherBranchId = randomUUID();
  const petId = randomUUID();

  const managerId = randomUUID();
  const otherManagerId = randomUUID();
  const groomerId = randomUUID();
  const secondGroomerId = randomUUID();
  const otherGroomerId = randomUUID();
  const cashierId = randomUUID();
  const ownerId = randomUUID();

  const userIds = [
    managerId,
    otherManagerId,
    groomerId,
    secondGroomerId,
    otherGroomerId,
    cashierId,
    ownerId,
  ];

  const branchIds = [branchId, otherBranchId];
  const password = 'PetopiaTest2026!';
  const date = '2030-01-15';

  const firstBookingId = randomUUID();
  const secondBookingId = randomUUID();
  const cancelledBookingId = randomUUID();
  const otherBranchBookingId = randomUUID();
  const previousDayBookingId = randomUUID();
  const nextDayBookingId = randomUUID();

  function email(userId: string): string {
    return `branch-bookings-${userId}@example.com`;
  }

  function agent(userId: string) {
    const result = agents.get(userId);

    if (!result) {
      throw new Error('Missing test agent');
    }

    return result;
  }

  function managerPath(targetBranchId = branchId): string {
    return `/branches/${targetBranchId}/bookings`;
  }

  function groomerPath(targetBranchId = branchId): string {
    return `/branches/${targetBranchId}/my-bookings`;
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    const business = await prisma.businessUnit.findUniqueOrThrow({
      where: { code: 'GROOMING' },
      select: { id: true },
    });

    const rate = await prisma.groomingServiceRate.findFirst({
      where: {
        active: true,
        species: PetSpecies.DOG,
        service: {
          businessUnitId: business.id,
          active: true,
        },
      },
      select: {
        id: true,
        serviceId: true,
        service: {
          select: {
            code: true,
            name: true,
            kind: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    if (!rate) {
      throw new Error('Run the baseline catalog seed in petopia_test first');
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    await prisma.$transaction(async (tx) => {
      await tx.branch.createMany({
        data: branchIds.map((id, index) => ({
          id,
          businessUnitId: business.id,
          code: `BB-${index}-${runId}`,
          name: `Branch Bookings ${index}`,
          timezone: 'Asia/Bangkok',
        })),
      });

      await tx.user.createMany({
        data: userIds.map((id) => ({
          id,
          email: email(id),
          displayName: `Test ${id}`,
          passwordHash,
        })),
      });

      await tx.staffAssignment.createMany({
        data: [
          {
            userId: managerId,
            branchId,
            role: StaffRole.BRANCH_MANAGER,
          },
          {
            userId: otherManagerId,
            branchId: otherBranchId,
            role: StaffRole.BRANCH_MANAGER,
          },
          {
            userId: groomerId,
            branchId,
            role: StaffRole.GROOMER,
          },
          {
            userId: groomerId,
            branchId: otherBranchId,
            role: StaffRole.GROOMER,
          },
          {
            userId: secondGroomerId,
            branchId,
            role: StaffRole.GROOMER,
          },
          {
            userId: otherGroomerId,
            branchId: otherBranchId,
            role: StaffRole.GROOMER,
          },
        ],
      });

      await tx.permissionGrant.create({
        data: {
          userId: cashierId,
          branchId,
          permission: StaffPermission.RECEIVE_PAYMENT,
        },
      });

      await tx.pet.create({
        data: {
          id: petId,
          ownerId,
          name: 'Current pet profile',
          species: PetSpecies.DOG,
          weightKg: 6,
        },
      });

      // Direct database fixtures isolate read behavior from booking creation.
      // Midnight fixtures deliberately exercise Bangkok day boundaries.
      const fixtures = [
        {
          id: firstBookingId,
          branchId,
          groomerId,
          startsAt: `${date}T09:00:00+07:00`,
          status: GroomingBookingStatus.CONFIRMED,
        },
        {
          id: secondBookingId,
          branchId,
          groomerId: secondGroomerId,
          startsAt: `${date}T10:00:00+07:00`,
          status: GroomingBookingStatus.COMPLETED,
        },
        {
          id: cancelledBookingId,
          branchId,
          groomerId,
          startsAt: `${date}T11:00:00+07:00`,
          status: GroomingBookingStatus.CANCELLED,
        },
        {
          id: otherBranchBookingId,
          branchId: otherBranchId,
          groomerId,
          startsAt: `${date}T13:00:00+07:00`,
          status: GroomingBookingStatus.NO_SHOW,
        },
        {
          id: previousDayBookingId,
          branchId,
          groomerId,
          startsAt: '2030-01-14T23:45:00+07:00',
          status: GroomingBookingStatus.CANCELLED,
        },
        {
          id: nextDayBookingId,
          branchId,
          groomerId,
          startsAt: '2030-01-16T00:00:00+07:00',
          status: GroomingBookingStatus.CANCELLED,
        },
      ];

      for (const fixture of fixtures) {
        const startsAt = new Date(fixture.startsAt);

        await tx.groomingBooking.create({
          data: {
            ...fixture,
            startsAt,
            ownerId,
            petId,
            petName: 'Stored pet snapshot',
            petSpecies: PetSpecies.DOG,
            petWeightKg: 5,
            serviceEndsAt: new Date(startsAt.getTime() + 30 * 60_000),
            occupiedEndsAt: new Date(startsAt.getTime() + 45 * 60_000),
            timezone: 'Asia/Bangkok',
            currency: 'THB',
            totalPriceSatang: 25000,
            totalDurationMinutes: 30,
            bufferMinutes: 15,
            items: {
              create: {
                serviceId: rate.serviceId,
                rateId: rate.id,
                code: rate.service.code,
                name: 'Stored service snapshot',
                kind: rate.service.kind,
                priceSatang: 25000,
                durationMinutes: 30,
                sortOrder: 0,
              },
            },
          },
        });
      }
    });

    for (const userId of userIds) {
      const session = request.agent(app.getHttpServer());

      await session
        .post('/auth/login')
        .send({ email: email(userId), password })
        .expect(200);

      agents.set(userId, session);
    }
  }, 60_000);

  beforeEach(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.branchClosure.deleteMany({
        where: { branchId: { in: branchIds } },
      });

      await tx.user.updateMany({
        where: { id: { in: userIds } },
        data: { active: true },
      });

      await tx.staffAssignment.updateMany({
        where: { userId: { in: userIds } },
        data: { active: true },
      });

      await tx.branch.updateMany({
        where: { id: { in: branchIds } },
        data: { active: true, timezone: 'Asia/Bangkok' },
      });
    });
  });

  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.$transaction(async (tx) => {
          await tx.groomingBookingRequest.deleteMany({
            where: {
              booking: {
                branchId: { in: branchIds },
              },
            },
          });

          await tx.groomingBookingItem.deleteMany({
            where: {
              booking: {
                branchId: { in: branchIds },
              },
            },
          });

          await tx.groomingBooking.deleteMany({
            where: {
              branchId: { in: branchIds },
            },
          });

          await tx.branchClosure.deleteMany({
            where: {
              branchId: { in: branchIds },
            },
          });

          await tx.permissionGrant.deleteMany({
            where: {
              userId: { in: userIds },
            },
          });

          await tx.staffAssignment.deleteMany({
            where: {
              userId: { in: userIds },
            },
          });

          await tx.pet.deleteMany({
            where: { id: petId },
          });

          for (const userId of userIds) {
            await tx.session.deleteMany({
              where: {
                sess: {
                  path: ['userId'],
                  equals: userId,
                },
              },
            });
          }

          await tx.user.deleteMany({
            where: {
              id: { in: userIds },
            },
          });

          await tx.branch.deleteMany({
            where: {
              id: { in: branchIds },
            },
          });
        });
      }
    } finally {
      if (app) await app.close();
    }
  }, 30_000);

  it('[TC-CLOSURE-005] creates, lists and deletes a full-day closure over HTTP', async () => {
    const path = `/branches/${branchId}/closures`;

    const before = await prisma.branch.findUniqueOrThrow({
      where: { id: branchId },
      select: { scheduleVersion: true },
    });

    const created = await agent(managerId)
      .post(path)
      .send({
        startsAt: '2030-01-17T00:00:00+07:00',
        endsAt: '2030-01-18T00:00:00+07:00',
        reason: '  Full-day test  ',
      })
      .expect(201)
      .expect('Cache-Control', 'no-store');

    const closure = readRecord(created.body as unknown);

    if (typeof closure.id !== 'string') {
      throw new Error('Expected closure ID');
    }

    expect(closure).toMatchObject({
      startsAt: '2030-01-16T17:00:00.000Z',
      endsAt: '2030-01-17T17:00:00.000Z',
      reason: 'Full-day test',
    });

    const listed = await agent(managerId)
      .get(path)
      .expect(200)
      .expect('Cache-Control', 'no-store');

    expect(listed.body as unknown).toEqual([
      expect.objectContaining({ id: closure.id }),
    ]);

    const afterCreate = await prisma.branch.findUniqueOrThrow({
      where: { id: branchId },
      select: { scheduleVersion: true },
    });

    expect(afterCreate.scheduleVersion).toBe(before.scheduleVersion + 1);

    await agent(managerId)
      .delete(`${path}/${closure.id}`)
      .expect(204)
      .expect('Cache-Control', 'no-store');

    const afterDelete = await prisma.branch.findUniqueOrThrow({
      where: { id: branchId },
      select: { scheduleVersion: true },
    });

    expect(afterDelete.scheduleVersion).toBe(before.scheduleVersion + 2);

    const empty = await agent(managerId).get(path).expect(200);
    expect(empty.body as unknown).toEqual([]);

    await agent(managerId).delete(`${path}/${closure.id}`).expect(404);

    const afterRepeatedDelete = await prisma.branch.findUniqueOrThrow({
      where: { id: branchId },
      select: { scheduleVersion: true },
    });

    expect(afterRepeatedDelete.scheduleVersion).toBe(
      afterDelete.scheduleVersion,
    );
  });

  it('[TC-CLOSURE-006] isolates closure listings and deletion by branch', async () => {
    const created = await agent(managerId)
      .post(`/branches/${branchId}/closures`)
      .send({
        startsAt: '2030-01-17T09:00:00+07:00',
        endsAt: '2030-01-17T10:00:00+07:00',
      })
      .expect(201);

    const closure = readRecord(created.body as unknown);

    if (typeof closure.id !== 'string') {
      throw new Error('Expected closure ID');
    }

    const otherList = await agent(otherManagerId)
      .get(`/branches/${otherBranchId}/closures`)
      .expect(200);

    expect(otherList.body as unknown).toEqual([]);

    await agent(otherManagerId)
      .delete(`/branches/${otherBranchId}/closures/${closure.id}`)
      .expect(404);

    expect(
      await prisma.branchClosure.count({
        where: { id: closure.id, branchId },
      }),
    ).toBe(1);
  });

  it('[TC-CLOSURE-007] requires authentication for every closure endpoint', async () => {
    const path = `/branches/${branchId}/closures`;
    const closureId = randomUUID();

    await request(app.getHttpServer()).get(path).expect(401);

    await request(app.getHttpServer())
      .post(path)
      .send({
        startsAt: '2030-01-17T09:00:00+07:00',
        endsAt: '2030-01-17T10:00:00+07:00',
      })
      .expect(401);

    await request(app.getHttpServer())
      .delete(`${path}/${closureId}`)
      .expect(401);
  });

  it('[TC-CLOSURE-008] denies customers, groomers, payment-only accounts and another branch manager', async () => {
    const path = `/branches/${branchId}/closures`;

    const closure = await prisma.branchClosure.create({
      data: {
        branchId,
        startsAt: new Date('2030-01-17T09:00:00+07:00'),
        endsAt: new Date('2030-01-17T10:00:00+07:00'),
      },
    });

    for (const userId of [ownerId, groomerId, cashierId, otherManagerId]) {
      await agent(userId).get(path).expect(403);

      await agent(userId)
        .post(path)
        .send({
          startsAt: '2030-01-17T11:00:00+07:00',
          endsAt: '2030-01-17T12:00:00+07:00',
        })
        .expect(403);

      await agent(userId).delete(`${path}/${closure.id}`).expect(403);
    }

    expect(await prisma.branchClosure.count({ where: { branchId } })).toBe(1);
  });

  it.each([
    {},
    {
      startsAt: '2030-01-17T09:00:00+07:00',
      endsAt: '2030-01-17T09:00:00+07:00',
    },
    {
      startsAt: '2030-01-17T10:00:00+07:00',
      endsAt: '2030-01-17T09:00:00+07:00',
    },
    {
      startsAt: '2030-01-17T09:00:00',
      endsAt: '2030-01-17T10:00:00',
    },
    {
      startsAt: '2030-02-30T09:00:00+07:00',
      endsAt: '2030-02-30T10:00:00+07:00',
    },
    {
      startsAt: '2030-01-17T09:00:00+07:00',
      endsAt: '2030-01-17T10:00:00+07:00',
      reason: 123,
    },
    {
      startsAt: '2030-01-17T09:00:00+07:00',
      endsAt: '2030-01-17T10:00:00+07:00',
      reason: 'x'.repeat(501),
    },
  ])(
    '[TC-CLOSURE-009] rejects invalid closure input %j without writes',
    async (body) => {
      const before = await prisma.branch.findUniqueOrThrow({
        where: { id: branchId },
        select: { scheduleVersion: true },
      });

      await agent(managerId)
        .post(`/branches/${branchId}/closures`)
        .send(body)
        .expect(400);

      expect(await prisma.branchClosure.count({ where: { branchId } })).toBe(0);

      const after = await prisma.branch.findUniqueOrThrow({
        where: { id: branchId },
        select: { scheduleVersion: true },
      });

      expect(after.scheduleVersion).toBe(before.scheduleVersion);
    },
  );

  it('[TC-CLOSURE-010] rejects malformed IDs', async () => {
    await agent(managerId).get('/branches/invalid/closures').expect(400);

    await agent(managerId)
      .delete(`/branches/${branchId}/closures/invalid`)
      .expect(400);
  });

  it('[TC-BRBOOK-001] lists only the requested branch in ascending appointment order', async () => {
    const response = await agent(managerId)
      .get(managerPath())
      .query({ date })
      .expect(200)
      .expect('Cache-Control', 'no-store');

    expect(readItems(response.body as unknown).map((item) => item.id)).toEqual([
      firstBookingId,
      secondBookingId,
      cancelledBookingId,
    ]);

    expect(response.body as unknown).toMatchObject({
      date,
      timezone: 'Asia/Bangkok',
      branch: { id: branchId },
      pagination: {
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1,
      },
    });
  });

  it('[TC-BRBOOK-002] limits groomer results and totals to their own branch appointments', async () => {
    const response = await agent(groomerId)
      .get(groomerPath())
      .query({ date })
      .expect(200)
      .expect('Cache-Control', 'no-store');

    const items = readItems(response.body as unknown);

    expect(items.map((item) => item.id)).toEqual([
      firstBookingId,
      cancelledBookingId,
    ]);

    for (const item of items) {
      expect(readRecord(item.groomer).id).toBe(groomerId);
    }

    expect(response.body as unknown).toMatchObject({
      pagination: { total: 2, totalPages: 1 },
    });

    const otherBranch = await agent(groomerId)
      .get(groomerPath(otherBranchId))
      .query({ date })
      .expect(200);

    expect(
      readItems(otherBranch.body as unknown).map((item) => item.id),
    ).toEqual([otherBranchBookingId]);
  });

  it('[TC-BRBOOK-003] paginates without duplicates and returns an empty out-of-range page', async () => {
    const first = await agent(managerId)
      .get(managerPath())
      .query({ date, page: 1, limit: 2 })
      .expect(200);

    const second = await agent(managerId)
      .get(managerPath())
      .query({ date, page: 2, limit: 2 })
      .expect(200);

    expect(readItems(first.body as unknown).map((item) => item.id)).toEqual([
      firstBookingId,
      secondBookingId,
    ]);

    expect(readItems(second.body as unknown).map((item) => item.id)).toEqual([
      cancelledBookingId,
    ]);

    expect(second.body as unknown).toMatchObject({
      pagination: { page: 2, limit: 2, total: 3, totalPages: 2 },
    });

    const empty = await agent(managerId)
      .get(managerPath())
      .query({ date, page: 3, limit: 2 })
      .expect(200);

    expect(readItems(empty.body as unknown)).toEqual([]);
    expect(empty.body as unknown).toMatchObject({
      pagination: { total: 3, totalPages: 2 },
    });
  });

  it('[TC-BRBOOK-004] filters by Bangkok calendar dates including midnight boundaries', async () => {
    for (const [targetDate, expectedId] of [
      ['2030-01-14', previousDayBookingId],
      ['2030-01-16', nextDayBookingId],
    ]) {
      const response = await agent(managerId)
        .get(managerPath())
        .query({ date: targetDate })
        .expect(200);

      expect(
        readItems(response.body as unknown).map((item) => item.id),
      ).toEqual([expectedId]);
    }

    const empty = await agent(managerId)
      .get(managerPath())
      .query({ date: '2030-01-17' })
      .expect(200);

    expect(readItems(empty.body as unknown)).toEqual([]);
    expect(empty.body as unknown).toMatchObject({
      pagination: { total: 0, totalPages: 0 },
    });
  });

  it('[TC-BRBOOK-005] returns stored snapshots and only selected public user fields', async () => {
    const response = await agent(managerId)
      .get(managerPath())
      .query({ date })
      .expect(200);

    const booking = readItems(response.body as unknown)[0];

    expect(booking).toMatchObject({
      petName: 'Stored pet snapshot',
      petWeightKg: 5,
      totalPriceSatang: 25000,
      totalDurationMinutes: 30,
      items: [
        {
          name: 'Stored service snapshot',
          priceSatang: 25000,
          durationMinutes: 30,
        },
      ],
    });

    expect(Object.keys(readRecord(booking.owner)).sort()).toEqual([
      'displayName',
      'id',
    ]);

    expect(Object.keys(readRecord(booking.groomer)).sort()).toEqual([
      'displayName',
      'id',
    ]);

    expect(booking).not.toHaveProperty('pet');
    expect(booking).not.toHaveProperty('request');
  });

  it('[TC-BRBOOK-006] requires authentication on both endpoints', async () => {
    for (const path of [managerPath(), groomerPath()]) {
      await request(app.getHttpServer()).get(path).query({ date }).expect(401);
    }
  });

  it('[TC-BRBOOK-007] rejects customers and payment-only accounts', async () => {
    for (const userId of [ownerId, cashierId]) {
      for (const path of [managerPath(), groomerPath()]) {
        await agent(userId).get(path).query({ date }).expect(403);
      }
    }
  });

  it('[TC-BRBOOK-008] separates manager and groomer roles', async () => {
    await agent(managerId).get(groomerPath()).query({ date }).expect(403);
    await agent(groomerId).get(managerPath()).query({ date }).expect(403);
  });

  it('[TC-BRBOOK-009] rejects staff assigned only to another branch', async () => {
    for (const userId of [otherManagerId, otherGroomerId]) {
      for (const path of [managerPath(), groomerPath()]) {
        await agent(userId).get(path).query({ date }).expect(403);
      }
    }
  });

  it('[TC-BRBOOK-010] applies assignment revocation to existing sessions', async () => {
    await prisma.staffAssignment.updateMany({
      where: {
        branchId,
        userId: { in: [managerId, groomerId] },
      },
      data: { active: false },
    });

    await agent(managerId).get(managerPath()).query({ date }).expect(403);
    await agent(groomerId).get(groomerPath()).query({ date }).expect(403);
  });

  it('[TC-BRBOOK-011] rejects access to an inactive branch', async () => {
    await prisma.branch.update({
      where: { id: branchId },
      data: { active: false },
    });

    await agent(managerId).get(managerPath()).query({ date }).expect(403);
    await agent(groomerId).get(groomerPath()).query({ date }).expect(403);
  });

  it.each([
    {},
    { date: '2030-02-30' },
    { date: '2030-1-15' },
    { date: '2030-01-15T00:00:00Z' },
    { date, page: 0 },
    { date, page: 'abc' },
    { date, limit: 0 },
    { date, limit: 101 },
    { date, groomerId: secondGroomerId },
  ])(
    '[TC-BRBOOK-012] rejects invalid or unsupported query %j',
    async (query) => {
      await agent(managerId).get(managerPath()).query(query).expect(400);
      await agent(groomerId).get(groomerPath()).query(query).expect(400);
    },
  );

  it('[TC-BRBOOK-013] rejects malformed branch IDs', async () => {
    await agent(managerId)
      .get(managerPath('invalid'))
      .query({ date })
      .expect(400);

    await agent(groomerId)
      .get(groomerPath('invalid'))
      .query({ date })
      .expect(400);
  });

  it('[TC-BRBOOK-014] rejects unsupported branch timezones', async () => {
    await prisma.branch.update({
      where: { id: branchId },
      data: { timezone: 'UTC' },
    });

    await agent(managerId).get(managerPath()).query({ date }).expect(400);
    await agent(groomerId).get(groomerPath()).query({ date }).expect(400);
  });
});
