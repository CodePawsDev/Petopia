import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { StaffRole } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';

type Interval = {
  weekday: number;
  startMinute: number;
  endMinute: number;
};

function readId(value: unknown): string {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    typeof value.id !== 'string'
  ) {
    throw new Error('Expected an object with a string ID');
  }

  return value.id;
}

describe('Groomer schedules (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let managerA: ReturnType<typeof request.agent>;
  let managerB: ReturnType<typeof request.agent>;
  let customer: ReturnType<typeof request.agent>;

  const runId = randomUUID();
  const branchAId = randomUUID();
  const branchBId = randomUUID();
  const managerAId = randomUUID();
  const managerBId = randomUUID();
  const customerId = randomUUID();
  const groomerId = randomUUID();

  const branchIds = [branchAId, branchBId];
  const userIds = [managerAId, managerBId, customerId, groomerId];
  const password = 'PetopiaTest2026!';

  const managerAEmail = `schedule-a-${runId}@example.com`;
  const managerBEmail = `schedule-b-${runId}@example.com`;
  const customerEmail = `schedule-c-${runId}@example.com`;

  const baseline: Interval[] = [
    { weekday: 1, startMinute: 540, endMinute: 720 },
    { weekday: 1, startMinute: 780, endMinute: 1080 },
  ];

  const timeOffBody = {
    startsAt: '2026-11-02T13:00:00+07:00',
    endsAt: '2026-11-02T15:00:00+07:00',
    reason: 'Personal leave',
  };

  function weeklyPath(branchId = branchAId, userId = groomerId) {
    return `/branches/${branchId}/groomers/${userId}/weekly-schedule`;
  }

  function timeOffPath(branchId = branchAId, userId = groomerId) {
    return `/branches/${branchId}/groomers/${userId}/time-offs`;
  }

  async function storedIntervals(branchId: string) {
    return prisma.groomerWorkingInterval.findMany({
      where: { branchId, groomerId },
      orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
      select: {
        weekday: true,
        startMinute: true,
        endMinute: true,
      },
    });
  }

  async function scheduleVersion(branchId = branchAId) {
    const branch = await prisma.branch.findUniqueOrThrow({
      where: { id: branchId },
      select: { scheduleVersion: true },
    });

    return branch.scheduleVersion;
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

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    await prisma.$transaction(async (tx) => {
      await tx.branch.createMany({
        data: [
          {
            id: branchAId,
            businessUnitId: business.id,
            code: `SCH-A-${runId}`,
            name: 'Schedule Test A',
            timezone: 'Asia/Bangkok',
          },
          {
            id: branchBId,
            businessUnitId: business.id,
            code: `SCH-B-${runId}`,
            name: 'Schedule Test B',
            timezone: 'Asia/Bangkok',
          },
        ],
      });

      await tx.user.createMany({
        data: [
          {
            id: managerAId,
            email: managerAEmail,
            displayName: 'Schedule Manager A',
            passwordHash,
          },
          {
            id: managerBId,
            email: managerBEmail,
            displayName: 'Schedule Manager B',
            passwordHash,
          },
          {
            id: customerId,
            email: customerEmail,
            displayName: 'Schedule Customer',
            passwordHash,
          },
          {
            id: groomerId,
            email: `schedule-g-${runId}@example.com`,
            displayName: 'Schedule Groomer',
            passwordHash,
          },
        ],
      });

      await tx.staffAssignment.createMany({
        data: [
          {
            userId: managerAId,
            branchId: branchAId,
            role: StaffRole.BRANCH_MANAGER,
          },
          {
            userId: managerBId,
            branchId: branchBId,
            role: StaffRole.BRANCH_MANAGER,
          },
          {
            userId: groomerId,
            branchId: branchAId,
            role: StaffRole.GROOMER,
          },
          {
            userId: groomerId,
            branchId: branchBId,
            role: StaffRole.GROOMER,
          },
        ],
      });
    });

    managerA = request.agent(app.getHttpServer());
    managerB = request.agent(app.getHttpServer());
    customer = request.agent(app.getHttpServer());

    await managerA
      .post('/auth/login')
      .send({ email: managerAEmail, password })
      .expect(200);

    await managerB
      .post('/auth/login')
      .send({ email: managerBEmail, password })
      .expect(200);

    await customer
      .post('/auth/login')
      .send({ email: customerEmail, password })
      .expect(200);
  }, 30_000);

  beforeEach(async () => {
    await prisma.groomerWorkingInterval.deleteMany({
      where: { groomerId },
    });

    await prisma.groomerTimeOff.deleteMany({
      where: { groomerId },
    });
  });

  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.$transaction(async (tx) => {
          await tx.groomerWorkingInterval.deleteMany({
            where: { groomerId },
          });

          await tx.groomerTimeOff.deleteMany({
            where: { groomerId },
          });

          await tx.staffAssignment.deleteMany({
            where: { userId: { in: userIds } },
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
            where: { id: { in: userIds } },
          });

          await tx.branch.deleteMany({
            where: { id: { in: branchIds } },
          });
        });
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  }, 30_000);

  it('[TC-SCHED-001] reads an empty weekly schedule without exposing private user fields', async () => {
    await managerA
      .get(weeklyPath())
      .expect(200)
      .expect('Cache-Control', 'no-store')
      .expect({
        branch: {
          id: branchAId,
          code: `SCH-A-${runId}`,
          name: 'Schedule Test A',
          timezone: 'Asia/Bangkok',
          scheduleVersion: await scheduleVersion(),
        },
        groomer: {
          id: groomerId,
          displayName: 'Schedule Groomer',
        },
        intervals: [],
      });
  });

  it('[TC-SCHED-002] replaces, sorts and clears only the requested branch schedule', async () => {
    const otherBranch: Interval[] = [
      { weekday: 2, startMinute: 540, endMinute: 720 },
    ];

    await managerB
      .put(weeklyPath(branchBId))
      .send({ intervals: otherBranch })
      .expect(200);

    const version = await scheduleVersion();

    await managerA
      .put(weeklyPath())
      .send({ intervals: [...baseline].reverse() })
      .expect(200)
      .expect('Cache-Control', 'no-store');

    expect(await storedIntervals(branchAId)).toEqual(baseline);
    expect(await scheduleVersion()).toBe(version + 1);

    await managerA.put(weeklyPath()).send({ intervals: [] }).expect(200);

    expect(await storedIntervals(branchAId)).toEqual([]);
    expect(await storedIntervals(branchBId)).toEqual(otherBranch);
    expect(await scheduleVersion()).toBe(version + 2);
  });

  it.each([
    {
      name: 'an invalid weekday',
      body: {
        intervals: [{ weekday: 8, startMinute: 540, endMinute: 720 }],
      },
    },
    {
      name: 'time before opening',
      body: {
        intervals: [{ weekday: 1, startMinute: 539, endMinute: 720 }],
      },
    },
    {
      name: 'time after closing',
      body: {
        intervals: [{ weekday: 1, startMinute: 780, endMinute: 1081 }],
      },
    },
    {
      name: 'zero duration',
      body: {
        intervals: [{ weekday: 1, startMinute: 600, endMinute: 600 }],
      },
    },
    {
      name: 'reversed times',
      body: {
        intervals: [{ weekday: 1, startMinute: 720, endMinute: 600 }],
      },
    },
    {
      name: 'overlapping intervals',
      body: {
        intervals: [
          { weekday: 1, startMinute: 540, endMinute: 780 },
          { weekday: 1, startMinute: 720, endMinute: 1080 },
        ],
      },
    },
    {
      name: 'missing intervals',
      body: {},
    },
    {
      name: 'a numeric string',
      body: {
        intervals: [{ weekday: '1', startMinute: 540, endMinute: 720 }],
      },
    },
  ])(
    '[TC-SCHED-003] rejects $name and preserves the existing schedule and version',
    async ({ body }) => {
      await managerA
        .put(weeklyPath())
        .send({ intervals: baseline })
        .expect(200);

      const version = await scheduleVersion();

      await managerA.put(weeklyPath()).send(body).expect(400);

      expect(await storedIntervals(branchAId)).toEqual(baseline);
      expect(await scheduleVersion()).toBe(version);
    },
  );

  it('[TC-SCHED-004] allows adjacent intervals', async () => {
    const adjacent: Interval[] = [
      { weekday: 1, startMinute: 540, endMinute: 720 },
      { weekday: 1, startMinute: 720, endMinute: 1080 },
    ];

    await managerA.put(weeklyPath()).send({ intervals: adjacent }).expect(200);

    expect(await storedIntervals(branchAId)).toEqual(adjacent);
  });

  it('[TC-SCHED-005] rejects a cross-branch overlap without changing either schedule', async () => {
    const branchAIntervals: Interval[] = [
      { weekday: 1, startMinute: 540, endMinute: 720 },
    ];
    const branchBIntervals: Interval[] = [
      { weekday: 1, startMinute: 780, endMinute: 1080 },
    ];

    await managerA
      .put(weeklyPath())
      .send({ intervals: branchAIntervals })
      .expect(200);

    await managerB
      .put(weeklyPath(branchBId))
      .send({ intervals: branchBIntervals })
      .expect(200);

    const version = await scheduleVersion(branchBId);

    await managerB
      .put(weeklyPath(branchBId))
      .send({
        intervals: [{ weekday: 1, startMinute: 660, endMinute: 900 }],
      })
      .expect(409);

    expect(await storedIntervals(branchAId)).toEqual(branchAIntervals);
    expect(await storedIntervals(branchBId)).toEqual(branchBIntervals);
    expect(await scheduleVersion(branchBId)).toBe(version);
  });

  it('[TC-SCHED-006] persists only one of two conflicting cross-branch requests sent together', async () => {
    const intervals: Interval[] = [
      { weekday: 3, startMinute: 540, endMinute: 720 },
    ];

    const responses = await Promise.all([
      managerA.put(weeklyPath()).send({ intervals }),
      managerB.put(weeklyPath(branchBId)).send({ intervals }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);

    const winnerIndex = responses.findIndex(
      (response) => response.status === 200,
    );
    const winnerBranchId = winnerIndex === 0 ? branchAId : branchBId;
    const loserBranchId = winnerIndex === 0 ? branchBId : branchAId;

    expect(await storedIntervals(winnerBranchId)).toEqual(intervals);
    expect(await storedIntervals(loserBranchId)).toEqual([]);
  });

  it('[TC-SCHED-007] rejects unauthenticated access to every schedule endpoint', async () => {
    await request(app.getHttpServer()).get(weeklyPath()).expect(401);

    await request(app.getHttpServer())
      .put(weeklyPath())
      .send({ intervals: baseline })
      .expect(401);

    await request(app.getHttpServer()).get(timeOffPath()).expect(401);

    await request(app.getHttpServer())
      .post(timeOffPath())
      .send(timeOffBody)
      .expect(401);

    await request(app.getHttpServer())
      .delete(`${timeOffPath()}/${randomUUID()}`)
      .expect(401);
  });

  it.each([
    { name: 'a customer', actor: 'customer' },
    { name: 'another branch manager', actor: 'managerB' },
  ])(
    '[TC-SCHED-008] rejects $name on every schedule endpoint',
    async ({ actor }) => {
      const agent = actor === 'customer' ? customer : managerB;

      await agent.get(weeklyPath()).expect(403);

      await agent.put(weeklyPath()).send({ intervals: baseline }).expect(403);

      await agent.get(timeOffPath()).expect(403);

      await agent.post(timeOffPath()).send(timeOffBody).expect(403);

      await agent.delete(`${timeOffPath()}/${randomUUID()}`).expect(403);
    },
  );

  it('[TC-SCHED-009] rejects malformed IDs and a user without a groomer assignment', async () => {
    await managerA.get(weeklyPath(branchAId, 'abc')).expect(400);

    await managerA.get(weeklyPath(branchAId, customerId)).expect(404);

    await managerA
      .put(weeklyPath(branchAId, customerId))
      .send({ intervals: baseline })
      .expect(404);

    await managerA
      .post(timeOffPath(branchAId, customerId))
      .send(timeOffBody)
      .expect(404);
  });

  it('[TC-SCHED-010] rejects schedule management after the groomer assignment is deactivated', async () => {
    const where = {
      userId_branchId_role: {
        userId: groomerId,
        branchId: branchAId,
        role: StaffRole.GROOMER,
      },
    };

    try {
      await prisma.staffAssignment.update({
        where,
        data: { active: false },
      });

      await managerA.get(weeklyPath()).expect(404);

      await managerA
        .put(weeklyPath())
        .send({ intervals: baseline })
        .expect(404);

      await managerA.get(timeOffPath()).expect(404);

      await managerA.post(timeOffPath()).send(timeOffBody).expect(404);
    } finally {
      await prisma.staffAssignment.update({
        where,
        data: { active: true },
      });
    }
  });

  it('[TC-SCHED-011] creates, lists and deletes time off with UTC conversion and version changes', async () => {
    const version = await scheduleVersion();

    const response = await managerA
      .post(timeOffPath())
      .send({
        ...timeOffBody,
        reason: '  Personal leave  ',
      })
      .expect(201)
      .expect('Cache-Control', 'no-store');

    const timeOffId = readId(response.body);

    const expected = {
      id: timeOffId,
      startsAt: '2026-11-02T06:00:00.000Z',
      endsAt: '2026-11-02T08:00:00.000Z',
      reason: 'Personal leave',
    };

    expect(response.body as unknown).toMatchObject(expected);
    expect(await scheduleVersion()).toBe(version + 1);

    const listed = await managerA
      .get(timeOffPath())
      .expect(200)
      .expect('Cache-Control', 'no-store');

    const listedBody: unknown = listed.body;

    if (!Array.isArray(listedBody)) {
      throw new Error('Expected a time-off array');
    }

    expect(listedBody).toHaveLength(1);
    expect(listedBody[0] as unknown).toMatchObject(expected);

    const removed = await managerA
      .delete(`${timeOffPath()}/${timeOffId}`)
      .expect(204)
      .expect('Cache-Control', 'no-store');

    expect(removed.text).toBe('');
    expect(await scheduleVersion()).toBe(version + 2);

    await managerA.delete(`${timeOffPath()}/${timeOffId}`).expect(404);

    expect(await scheduleVersion()).toBe(version + 2);

    await managerA.get(timeOffPath()).expect(200).expect([]);
  });

  it.each([
    {
      name: 'zero duration',
      body: {
        startsAt: '2026-11-02T13:00:00+07:00',
        endsAt: '2026-11-02T13:00:00+07:00',
      },
    },
    {
      name: 'reversed times',
      body: {
        startsAt: '2026-11-02T15:00:00+07:00',
        endsAt: '2026-11-02T13:00:00+07:00',
      },
    },
    {
      name: 'missing timezone',
      body: {
        startsAt: '2026-11-02T13:00:00',
        endsAt: '2026-11-02T15:00:00',
      },
    },
    {
      name: 'an impossible date',
      body: {
        startsAt: '2026-02-30T13:00:00+07:00',
        endsAt: '2026-03-01T15:00:00+07:00',
      },
    },
    {
      name: 'missing fields',
      body: {},
    },
    {
      name: 'a non-string reason',
      body: { ...timeOffBody, reason: 123 },
    },
  ])(
    '[TC-SCHED-012] rejects time off with $name without writing data',
    async ({ body }) => {
      const version = await scheduleVersion();

      await managerA.post(timeOffPath()).send(body).expect(400);

      expect(
        await prisma.groomerTimeOff.count({
          where: { groomerId },
        }),
      ).toBe(0);

      expect(await scheduleVersion()).toBe(version);
    },
  );

  it('[TC-SCHED-013] supports full-day and overlapping time off without requiring a reason', async () => {
    const body = {
      startsAt: '2026-11-02T00:00:00+07:00',
      endsAt: '2026-11-03T00:00:00+07:00',
    };

    const fullDay = await managerA.post(timeOffPath()).send(body).expect(201);

    expect(fullDay.body as unknown).toMatchObject({
      startsAt: '2026-11-01T17:00:00.000Z',
      endsAt: '2026-11-02T17:00:00.000Z',
      reason: null,
    });

    await managerA.post(timeOffPath()).send(timeOffBody).expect(201);

    expect(
      await prisma.groomerTimeOff.count({
        where: { groomerId, branchId: branchAId },
      }),
    ).toBe(2);
  });

  it('[TC-SCHED-014] isolates time-off listings and prevents deletion through another branch', async () => {
    const created = await managerA
      .post(timeOffPath())
      .send(timeOffBody)
      .expect(201);

    const timeOffId = readId(created.body);
    const versionB = await scheduleVersion(branchBId);

    await managerB.get(timeOffPath(branchBId)).expect(200).expect([]);

    await managerB.delete(`${timeOffPath(branchBId)}/${timeOffId}`).expect(404);

    expect(
      await prisma.groomerTimeOff.count({
        where: { id: timeOffId },
      }),
    ).toBe(1);

    expect(await scheduleVersion(branchBId)).toBe(versionB);
  });
});
