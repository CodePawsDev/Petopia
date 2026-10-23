import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import {
  GroomingServiceKind,
  PetSpecies,
  StaffRole,
} from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';

type Slot = {
  startsAt: string;
  serviceEndsAt: string;
  occupiedEndsAt: string;
};

type GroomerResult = {
  id: string;
  slots: Slot[];
};

function readRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected an object');
  }

  return value as Record<string, unknown>;
}

function readGroomers(value: unknown): GroomerResult[] {
  const body = readRecord(value);

  if (!Array.isArray(body.groomers)) {
    throw new Error('Expected groomers');
  }

  return body.groomers.map((value: unknown) => {
    const groomer = readRecord(value);

    if (typeof groomer.id !== 'string' || !Array.isArray(groomer.slots)) {
      throw new Error('Invalid groomer response');
    }

    return {
      id: groomer.id,
      slots: groomer.slots.map((value: unknown) => {
        const slot = readRecord(value);

        if (
          typeof slot.startsAt !== 'string' ||
          typeof slot.serviceEndsAt !== 'string' ||
          typeof slot.occupiedEndsAt !== 'string'
        ) {
          throw new Error('Invalid slot response');
        }

        return {
          startsAt: slot.startsAt,
          serviceEndsAt: slot.serviceEndsAt,
          occupiedEndsAt: slot.occupiedEndsAt,
        };
      }),
    };
  });
}

describe('Availability (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let customer: ReturnType<typeof request.agent>;
  let bathId: string;
  let nailId: string;
  let date: string;
  let weekday: number;

  const runId = randomUUID();
  const branchId = randomUUID();
  const otherBranchId = randomUUID();
  const ownerId = randomUUID();
  const otherOwnerId = randomUUID();
  const groomerId = randomUUID();
  const petId = randomUUID();
  const rabbitId = randomUUID();
  const otherPetId = randomUUID();

  const userIds = [ownerId, otherOwnerId, groomerId];
  const branchIds = [branchId, otherBranchId];
  const petIds = [petId, rabbitId, otherPetId];
  const email = `availability-${runId}@example.com`;
  const password = 'PetopiaTest2026!';

  function localTime(time: string, targetDate = date): string {
    return new Date(`${targetDate}T${time}:00+07:00`).toISOString();
  }

  function payload() {
    return {
      branchId,
      petId,
      serviceIds: [bathId, nailId],
      date,
      groomerId,
    };
  }

  function starts(body: unknown): string[] {
    const groomers = readGroomers(body);

    expect(groomers).toHaveLength(1);
    expect(groomers[0].id).toBe(groomerId);

    return groomers[0].slots.map((slot) => slot.startsAt);
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

    const services = await prisma.groomingService.findMany({
      where: {
        businessUnitId: business.id,
        active: true,
      },
      select: { id: true, kind: true },
    });

    const bath = services.find(
      (service) => service.kind === GroomingServiceKind.BATH,
    );
    const nail = services.find(
      (service) => service.kind === GroomingServiceKind.NAIL_TRIMMING,
    );

    if (!bath || !nail) {
      throw new Error('Run the baseline catalog seed in petopia_test first');
    }

    bathId = bath.id;
    nailId = nail.id;

    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const bangkokDay = new Date(future.getTime() + 7 * 60 * 60 * 1000);

    date = bangkokDay.toISOString().slice(0, 10);
    weekday = bangkokDay.getUTCDay() || 7;

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
            id: branchId,
            businessUnitId: business.id,
            code: `AVL-A-${runId}`,
            name: 'Availability A',
            timezone: 'Asia/Bangkok',
          },
          {
            id: otherBranchId,
            businessUnitId: business.id,
            code: `AVL-B-${runId}`,
            name: 'Availability B',
            timezone: 'Asia/Bangkok',
          },
        ],
      });

      await tx.user.createMany({
        data: [
          {
            id: ownerId,
            email,
            displayName: 'Availability Customer',
            passwordHash,
          },
          {
            id: otherOwnerId,
            email: `availability-other-${runId}@example.com`,
            displayName: 'Other Customer',
            passwordHash,
          },
          {
            id: groomerId,
            email: `availability-groomer-${runId}@example.com`,
            displayName: 'Availability Groomer',
            passwordHash,
          },
        ],
      });

      await tx.staffAssignment.createMany({
        data: branchIds.map((id) => ({
          userId: groomerId,
          branchId: id,
          role: StaffRole.GROOMER,
        })),
      });

      await tx.pet.createMany({
        data: [
          {
            id: petId,
            ownerId,
            name: 'Availability Dog',
            species: PetSpecies.DOG,
            weightKg: 5,
          },
          {
            id: rabbitId,
            ownerId,
            name: 'Availability Rabbit',
            species: PetSpecies.RABBIT,
            weightKg: 3,
          },
          {
            id: otherPetId,
            ownerId: otherOwnerId,
            name: 'Other Dog',
            species: PetSpecies.DOG,
            weightKg: 5,
          },
        ],
      });

      await tx.groomerServiceSkill.createMany({
        data: [PetSpecies.DOG, PetSpecies.RABBIT].flatMap((species) =>
          [bathId, nailId].map((serviceId) => ({
            groomerId,
            serviceId,
            species,
          })),
        ),
      });
    });

    customer = request.agent(app.getHttpServer());

    await customer.post('/auth/login').send({ email, password }).expect(200);
  }, 30_000);

  beforeEach(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.groomerWorkingInterval.deleteMany({
        where: { groomerId },
      });
      await tx.groomerTimeOff.deleteMany({
        where: { groomerId },
      });
      await tx.branchClosure.deleteMany({
        where: { branchId: { in: branchIds } },
      });

      await tx.user.update({
        where: { id: groomerId },
        data: { active: true },
      });
      await tx.staffAssignment.updateMany({
        where: { userId: groomerId },
        data: { active: true },
      });
      await tx.groomerServiceSkill.updateMany({
        where: { groomerId },
        data: { active: true },
      });
      await tx.pet.update({
        where: { id: petId },
        data: { archivedAt: null, weightKg: 5 },
      });

      await tx.groomerWorkingInterval.createMany({
        data: [
          {
            groomerId,
            branchId,
            weekday,
            startMinute: 540,
            endMinute: 720,
          },
          {
            groomerId,
            branchId,
            weekday,
            startMinute: 780,
            endMinute: 1080,
          },
        ],
      });
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
          await tx.branchClosure.deleteMany({
            where: { branchId: { in: branchIds } },
          });
          await tx.groomerServiceSkill.deleteMany({
            where: { groomerId },
          });
          await tx.staffAssignment.deleteMany({
            where: { userId: { in: userIds } },
          });
          await tx.pet.deleteMany({
            where: { id: { in: petIds } },
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
      if (app) await app.close();
    }
  }, 30_000);

  it('[TC-AVL-001] calculates price, duration, buffer and Bangkok slots', async () => {
    const response = await customer
      .post('/availability/search')
      .send(payload())
      .expect(200)
      .expect('Cache-Control', 'no-store');

    expect(response.body as unknown).toMatchObject({
      date,
      timezone: 'Asia/Bangkok',
      slotIntervalMinutes: 15,
      bufferMinutes: 15,
      reason: 'AVAILABLE',
      quote: {
        pet: { id: petId, species: 'DOG', weightKg: 5 },
        totalPriceSatang: 40000,
        totalDurationMinutes: 55,
        requiresAssessment: false,
      },
    });

    const slots = readGroomers(response.body)[0].slots;

    expect(slots[0]).toEqual({
      startsAt: localTime('09:00'),
      serviceEndsAt: localTime('09:55'),
      occupiedEndsAt: localTime('10:10'),
    });

    expect(starts(response.body)).toEqual([
      ...Array.from({ length: 8 }, (_, index) =>
        new Date(
          new Date(localTime('09:00')).getTime() + index * 15 * 60_000,
        ).toISOString(),
      ),
      ...Array.from({ length: 16 }, (_, index) =>
        new Date(
          new Date(localTime('13:00')).getTime() + index * 15 * 60_000,
        ).toISOString(),
      ),
    ]);
  });

  it('[TC-AVL-002] searches eligible branch groomers without a groomer ID', async () => {
    const body = payload();
    const response = await customer
      .post('/availability/search')
      .send({
        branchId: body.branchId,
        petId: body.petId,
        serviceIds: body.serviceIds,
        date: body.date,
      })
      .expect(200);

    expect(readGroomers(response.body).map((groomer) => groomer.id)).toEqual([
      groomerId,
    ]);
    expect(starts(response.body)).toContain(localTime('09:00'));
  });

  it('[TC-AVL-003] blocks time off recorded through another branch, including buffer overlap', async () => {
    await prisma.groomerTimeOff.create({
      data: {
        groomerId,
        branchId: otherBranchId,
        startsAt: new Date(localTime('10:00')),
        endsAt: new Date(localTime('10:30')),
      },
    });

    const response = await customer
      .post('/availability/search')
      .send(payload())
      .expect(200);

    const available = starts(response.body);

    expect(available).not.toContain(localTime('09:00'));
    expect(available).not.toContain(localTime('10:15'));
    expect(available).toContain(localTime('10:30'));
    expect(available).toContain(localTime('13:00'));
  });

  it('[TC-AVL-004] blocks branch closures and allows adjacent slots', async () => {
    await prisma.branchClosure.create({
      data: {
        branchId,
        startsAt: new Date(localTime('14:10')),
        endsAt: new Date(localTime('15:00')),
      },
    });

    const response = await customer
      .post('/availability/search')
      .send(payload())
      .expect(200);

    const available = starts(response.body);

    expect(available).toContain(localTime('13:00'));
    expect(available).not.toContain(localTime('13:15'));
    expect(available).not.toContain(localTime('14:45'));
    expect(available).toContain(localTime('15:00'));
  });

  it('[TC-AVL-005] ignores closures belonging to another branch', async () => {
    await prisma.branchClosure.create({
      data: {
        branchId: otherBranchId,
        startsAt: new Date(localTime('09:00')),
        endsAt: new Date(localTime('18:00')),
      },
    });

    const response = await customer
      .post('/availability/search')
      .send(payload())
      .expect(200);

    expect(starts(response.body)).toContain(localTime('09:00'));
  });

  it('[TC-AVL-006] returns no slots for a fully closed branch', async () => {
    await prisma.branchClosure.create({
      data: {
        branchId,
        startsAt: new Date(localTime('00:00')),
        endsAt: new Date(localTime('23:59')),
      },
    });

    const response = await customer
      .post('/availability/search')
      .send(payload())
      .expect(200);

    expect(response.body as unknown).toMatchObject({
      reason: 'NO_AVAILABLE_SLOTS',
    });
    expect(starts(response.body)).toEqual([]);
  });

  it('[TC-AVL-007] requires every selected service skill', async () => {
    await prisma.groomerServiceSkill.updateMany({
      where: { groomerId, serviceId: nailId, species: PetSpecies.DOG },
      data: { active: false },
    });

    const response = await customer
      .post('/availability/search')
      .send(payload())
      .expect(200);

    expect(response.body as unknown).toMatchObject({
      reason: 'NO_ELIGIBLE_GROOMERS',
      groomers: [],
    });
  });

  it('[TC-AVL-008] rejects a groomer with an inactive branch assignment', async () => {
    await prisma.staffAssignment.updateMany({
      where: { userId: groomerId, branchId },
      data: { active: false },
    });

    await customer.post('/availability/search').send(payload()).expect(404);
  });

  it('[TC-AVL-009] rejects an inactive groomer', async () => {
    await prisma.user.update({
      where: { id: groomerId },
      data: { active: false },
    });

    await customer.post('/availability/search').send(payload()).expect(404);
  });

  it('[TC-AVL-010] returns assessment required for rabbit services', async () => {
    const response = await customer
      .post('/availability/search')
      .send({ ...payload(), petId: rabbitId })
      .expect(200);

    expect(response.body as unknown).toMatchObject({
      reason: 'ASSESSMENT_REQUIRED',
      groomers: [],
      quote: { requiresAssessment: true },
    });
  });

  it('[TC-AVL-011] rejects requests without a session', async () => {
    await request(app.getHttpServer())
      .post('/availability/search')
      .send(payload())
      .expect(401);
  });

  it('[TC-AVL-012] hides another customer pet', async () => {
    await customer
      .post('/availability/search')
      .send({ ...payload(), petId: otherPetId })
      .expect(404);
  });

  it('[TC-AVL-013] rejects an archived pet', async () => {
    await prisma.pet.update({
      where: { id: petId },
      data: { archivedAt: new Date() },
    });

    await customer.post('/availability/search').send(payload()).expect(404);
  });

  it('[TC-AVL-014] rejects a pet without a stored weight', async () => {
    await prisma.pet.update({
      where: { id: petId },
      data: { weightKg: null },
    });

    await customer.post('/availability/search').send(payload()).expect(400);
  });

  it.each([
    { name: 'an impossible date', changes: { date: '2026-02-30' } },
    { name: 'a malformed date', changes: { date: '26/10/2026' } },
    { name: 'a malformed groomer ID', changes: { groomerId: 'abc' } },
  ])('[TC-AVL-015] rejects $name', async ({ changes }) => {
    await customer
      .post('/availability/search')
      .send({ ...payload(), ...changes })
      .expect(400);
  });

  it('[TC-AVL-016] returns no slots beyond the booking window', async () => {
    const outside = new Date(
      new Date(`${date}T00:00:00+07:00`).getTime() + 35 * 24 * 60 * 60 * 1000,
    );
    const outsideDate = new Date(outside.getTime() + 7 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const response = await customer
      .post('/availability/search')
      .send({ ...payload(), date: outsideDate })
      .expect(200);

    expect(response.body as unknown).toMatchObject({
      reason: 'NO_AVAILABLE_SLOTS',
    });
    expect(starts(response.body)).toEqual([]);
  });
});
