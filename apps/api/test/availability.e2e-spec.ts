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
import { ConflictException } from '@nestjs/common';
import { GroomerSchedulesService } from '../src/groomer-schedules/groomer-schedules.service';
import { GroomerTimeOffsService } from '../src/groomer-schedules/groomer-time-offs.service';

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
  function bookingPayload() {
    return {
      branchId,
      petId,
      groomerId,
      serviceIds: [bathId, nailId],
      startsAt: localTime('09:00'),
      requestKey: randomUUID(),
    };
  }

  async function expectNoBookings() {
    expect(
      await prisma.groomingBooking.count({
        where: { groomerId },
      }),
    ).toBe(0);

    expect(
      await prisma.groomingBookingItem.count({
        where: {
          booking: { groomerId },
        },
      }),
    ).toBe(0);
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
      await tx.groomingBookingRequest.deleteMany({
        where: {
          booking: { groomerId },
        },
      });

      await tx.groomingBookingItem.deleteMany({
        where: {
          booking: { groomerId },
        },
      });

      await tx.groomingBooking.deleteMany({
        where: { groomerId },
      });

      await tx.groomerWorkingInterval.deleteMany({
        where: { groomerId },
      });

      await tx.groomerTimeOff.deleteMany({
        where: { groomerId },
      });

      await tx.branchClosure.deleteMany({
        where: {
          branchId: { in: branchIds },
        },
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
        data: {
          archivedAt: null,
          weightKg: 5,
        },
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
          await tx.groomingBookingRequest.deleteMany({
            where: {
              booking: { groomerId },
            },
          });

          await tx.groomingBookingItem.deleteMany({
            where: {
              booking: { groomerId },
            },
          });

          await tx.groomingBooking.deleteMany({
            where: { groomerId },
          });

          // คำสั่งล้างข้อมูลอื่น ๆ ด้านล่าง เก็บไว้ตามเดิม
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
  it('[TC-IDEM-001] returns the same booking for a repeated request', async () => {
    const body = bookingPayload();

    const first = await customer.post('/bookings').send(body).expect(201);

    const second = await customer.post('/bookings').send(body).expect(201);

    const original = readRecord(first.body as unknown);
    const repeated = readRecord(second.body as unknown);

    expect(typeof original.id).toBe('string');
    expect(repeated.id).toBe(original.id);
    expect(repeated.createdAt).toBe(original.createdAt);

    expect(await prisma.groomingBooking.count({ where: { groomerId } })).toBe(
      1,
    );

    expect(
      await prisma.groomingBookingRequest.count({
        where: { ownerId, requestKey: body.requestKey },
      }),
    ).toBe(1);
  });

  it('[TC-IDEM-002] creates one booking when the same request is sent concurrently', async () => {
    const body = bookingPayload();

    const responses = await Promise.all([
      customer.post('/bookings').send(body),
      customer.post('/bookings').send(body),
    ]);

    expect(responses.map((response) => response.status)).toEqual([201, 201]);

    const first = readRecord(responses[0].body as unknown);
    const second = readRecord(responses[1].body as unknown);

    expect(typeof first.id).toBe('string');
    expect(second.id).toBe(first.id);

    expect(await prisma.groomingBooking.count({ where: { groomerId } })).toBe(
      1,
    );

    expect(
      await prisma.groomingBookingRequest.count({
        where: { ownerId, requestKey: body.requestKey },
      }),
    ).toBe(1);
  });

  it('[TC-IDEM-003] rejects the same key with different booking details', async () => {
    const body = bookingPayload();

    await customer.post('/bookings').send(body).expect(201);

    const response = await customer
      .post('/bookings')
      .send({ ...body, serviceIds: [bathId] })
      .expect(409);

    expect(response.body as unknown).toMatchObject({
      code: 'BOOKING_REQUEST_REUSED',
    });

    expect(await prisma.groomingBooking.count({ where: { groomerId } })).toBe(
      1,
    );
  });

  it('[TC-IDEM-004] recognizes equivalent timestamps and reordered services', async () => {
    const body = bookingPayload();

    const first = await customer.post('/bookings').send(body).expect(201);

    const second = await customer
      .post('/bookings')
      .send({
        ...body,
        startsAt: `${date}T09:00:00+07:00`,
        serviceIds: [...body.serviceIds].reverse(),
      })
      .expect(201);

    expect(readRecord(second.body as unknown).id).toBe(
      readRecord(first.body as unknown).id,
    );

    expect(await prisma.groomingBooking.count({ where: { groomerId } })).toBe(
      1,
    );
  });

  it('[TC-IDEM-005] returns a cancelled booking without recreating it', async () => {
    const body = bookingPayload();

    const created = await customer.post('/bookings').send(body).expect(201);

    const booking = readRecord(created.body as unknown);

    if (typeof booking.id !== 'string') {
      throw new Error('Expected booking ID');
    }

    await customer.post(`/bookings/${booking.id}/cancel`).expect(200);

    const repeated = await customer.post('/bookings').send(body).expect(201);

    expect(repeated.body as unknown).toMatchObject({
      id: booking.id,
      status: 'CANCELLED',
    });

    expect(await prisma.groomingBooking.count({ where: { groomerId } })).toBe(
      1,
    );

    // Intentionally starting a new booking uses a new request key.
    const replacement = await customer
      .post('/bookings')
      .send({ ...body, requestKey: randomUUID() })
      .expect(201);

    expect(readRecord(replacement.body as unknown).id).not.toBe(booking.id);
  });

  it('[TC-IDEM-006] rejects a missing request key without writing data', async () => {
    const body: Record<string, unknown> = { ...bookingPayload() };
    delete body.requestKey;

    await customer.post('/bookings').send(body).expect(400);

    await expectNoBookings();

    expect(
      await prisma.groomingBookingRequest.count({
        where: { ownerId },
      }),
    ).toBe(0);
  });

  it('[TC-IDEM-007] rolls back the request record when booking fails', async () => {
    const body = {
      ...bookingPayload(),
      startsAt: localTime('12:00'),
    };

    // This time falls inside the fixture's lunch break.
    await customer.post('/bookings').send(body).expect(409);

    await expectNoBookings();

    expect(
      await prisma.groomingBookingRequest.count({
        where: { ownerId, requestKey: body.requestKey },
      }),
    ).toBe(0);
  });

  it('[TC-IDEM-008] scopes request keys to the authenticated owner', async () => {
    const body = bookingPayload();

    const original = await customer.post('/bookings').send(body).expect(201);

    const otherCustomer = request.agent(app.getHttpServer());

    await otherCustomer
      .post('/auth/login')
      .send({
        email: `availability-other-${runId}@example.com`,
        password,
      })
      .expect(200);

    const other = await otherCustomer
      .post('/bookings')
      .send({
        ...body,
        petId: otherPetId,
        startsAt: localTime('13:00'),
      })
      .expect(201);

    expect(readRecord(other.body as unknown).id).not.toBe(
      readRecord(original.body as unknown).id,
    );

    expect(
      await prisma.groomingBookingRequest.count({
        where: { requestKey: body.requestKey },
      }),
    ).toBe(2);
  });

  it('[TC-BOOK-001] creates one booking and removes its occupied interval from availability', async () => {
    const response = await customer
      .post('/bookings')
      .send(bookingPayload())
      .expect(201)
      .expect('Cache-Control', 'no-store');

    expect(response.body as unknown).toMatchObject({
      status: 'CONFIRMED',
      branchId,
      petId,
      groomerId,
      totalPriceSatang: 40000,
      totalDurationMinutes: 55,
      bufferMinutes: 15,
      startsAt: localTime('09:00'),
      serviceEndsAt: localTime('09:55'),
      occupiedEndsAt: localTime('10:10'),
    });

    const stored = await prisma.groomingBooking.findMany({
      where: { groomerId },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    expect(stored).toHaveLength(1);
    expect(stored[0].items).toHaveLength(2);
    expect(
      stored[0].items.reduce((total, item) => total + item.priceSatang, 0),
    ).toBe(stored[0].totalPriceSatang);
    expect(
      stored[0].items.reduce((total, item) => total + item.durationMinutes, 0),
    ).toBe(stored[0].totalDurationMinutes);

    const available = await customer
      .post('/availability/search')
      .send(payload())
      .expect(200);

    const availableStarts = starts(available.body);

    expect(availableStarts).not.toContain(localTime('09:00'));
    expect(availableStarts).not.toContain(localTime('10:00'));
    expect(availableStarts).toContain(localTime('10:15'));
  });

  it('[TC-BOOK-002] persists only one of two competing booking requests', async () => {
    const body = {
      branchId,
      petId,
      groomerId,
      serviceIds: [bathId, nailId],
      startsAt: localTime('09:00'),
    };

    const responses = await Promise.all([
      customer.post('/bookings').send({ ...body, requestKey: randomUUID() }),
      customer.post('/bookings').send({ ...body, requestKey: randomUUID() }),
    ]);

    expect(
      responses.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([201, 409]);

    const bookings = await prisma.groomingBooking.findMany({
      where: { groomerId },
      include: { items: true },
    });

    expect(bookings).toHaveLength(1);
    expect(bookings[0].items).toHaveLength(2);
  });
  it('[TC-BOOK-003] rejects booking without a session', async () => {
    await request(app.getHttpServer())
      .post('/bookings')
      .send(bookingPayload())
      .expect(401);

    await expectNoBookings();
  });

  it('[TC-BOOK-004] rejects booking another customer pet', async () => {
    await customer
      .post('/bookings')
      .send({ ...bookingPayload(), petId: otherPetId })
      .expect(404);

    await expectNoBookings();
  });

  it('[TC-BOOK-005] rejects assessment-required booking', async () => {
    await customer
      .post('/bookings')
      .send({ ...bookingPayload(), petId: rabbitId })
      .expect(400);

    await expectNoBookings();
  });

  it.each([
    {
      name: 'a start outside a 15-minute boundary',
      time: '09:01',
      expectedStatus: 400,
    },
    {
      name: 'a start during the lunch break',
      time: '12:00',
      expectedStatus: 409,
    },
    {
      name: 'a start whose buffer crosses closing time',
      time: '17:00',
      expectedStatus: 409,
    },
  ])('[TC-BOOK-006] rejects $name', async ({ time, expectedStatus }) => {
    await customer
      .post('/bookings')
      .send({
        ...bookingPayload(),
        startsAt: localTime(time),
      })
      .expect(expectedStatus);

    await expectNoBookings();
  });

  it('[TC-BOOK-007] rejects booking when a required skill is inactive', async () => {
    await prisma.groomerServiceSkill.updateMany({
      where: {
        groomerId,
        serviceId: nailId,
        species: PetSpecies.DOG,
      },
      data: { active: false },
    });

    await customer.post('/bookings').send(bookingPayload()).expect(409);

    await expectNoBookings();
  });

  it('[TC-BOOK-008] preserves the weekly schedule and version when a change cuts off a booking buffer', async () => {
    await customer.post('/bookings').send(bookingPayload()).expect(201);

    const before = await prisma.groomerWorkingInterval.findMany({
      where: { branchId, groomerId },
      orderBy: { id: 'asc' },
    });

    const branchBefore = await prisma.branch.findUniqueOrThrow({
      where: { id: branchId },
      select: { scheduleVersion: true },
    });

    const schedules = app.get(GroomerSchedulesService);

    await expect(
      schedules.replaceWeeklySchedule(branchId, groomerId, {
        intervals: [
          {
            weekday,
            startMinute: 540,
            endMinute: 595,
          },
          {
            weekday,
            startMinute: 780,
            endMinute: 1080,
          },
        ],
      }),
    ).rejects.toThrow(ConflictException);

    expect(
      await prisma.groomerWorkingInterval.findMany({
        where: { branchId, groomerId },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(before);

    expect(
      await prisma.branch.findUniqueOrThrow({
        where: { id: branchId },
        select: { scheduleVersion: true },
      }),
    ).toEqual(branchBefore);
  });

  it('[TC-BOOK-009] rejects cross-branch time off overlapping only the booking buffer', async () => {
    await customer.post('/bookings').send(bookingPayload()).expect(201);

    const branchBefore = await prisma.branch.findUniqueOrThrow({
      where: { id: otherBranchId },
      select: { scheduleVersion: true },
    });

    const timeOffs = app.get(GroomerTimeOffsService);

    await expect(
      timeOffs.create(otherBranchId, groomerId, {
        startsAt: localTime('10:00'),
        endsAt: localTime('10:05'),
        reason: 'Buffer conflict test',
      }),
    ).rejects.toThrow(ConflictException);

    expect(
      await prisma.groomerTimeOff.count({
        where: { groomerId },
      }),
    ).toBe(0);

    expect(
      await prisma.branch.findUniqueOrThrow({
        where: { id: otherBranchId },
        select: { scheduleVersion: true },
      }),
    ).toEqual(branchBefore);
  });
  it('[TC-BOOK-010] allows a schedule change that preserves the full booking and buffer', async () => {
    await customer.post('/bookings').send(bookingPayload()).expect(201);

    const branchBefore = await prisma.branch.findUniqueOrThrow({
      where: { id: branchId },
      select: { scheduleVersion: true },
    });

    const intervals = [
      {
        weekday,
        startMinute: 540,
        endMinute: 610,
      },
      {
        weekday,
        startMinute: 780,
        endMinute: 1080,
      },
    ];

    const schedules = app.get(GroomerSchedulesService);

    await schedules.replaceWeeklySchedule(branchId, groomerId, {
      intervals,
    });

    expect(
      await prisma.groomerWorkingInterval.findMany({
        where: { branchId, groomerId },
        orderBy: { startMinute: 'asc' },
        select: {
          weekday: true,
          startMinute: true,
          endMinute: true,
        },
      }),
    ).toEqual(intervals);

    const branchAfter = await prisma.branch.findUniqueOrThrow({
      where: { id: branchId },
      select: { scheduleVersion: true },
    });

    expect(branchAfter.scheduleVersion).toBe(branchBefore.scheduleVersion + 1);

    expect(
      await prisma.groomingBooking.count({
        where: { groomerId, status: 'CONFIRMED' },
      }),
    ).toBe(1);
  });

  it('[TC-BOOK-011] allows time off starting exactly at the occupied end', async () => {
    await customer.post('/bookings').send(bookingPayload()).expect(201);

    const timeOffs = app.get(GroomerTimeOffsService);

    const created = await timeOffs.create(branchId, groomerId, {
      startsAt: localTime('10:10'),
      endsAt: localTime('10:30'),
      reason: 'Adjacent time off',
    });

    expect(created.startsAt.toISOString()).toBe(localTime('10:10'));

    expect(
      await prisma.groomerTimeOff.count({
        where: { groomerId },
      }),
    ).toBe(1);

    expect(
      await prisma.groomingBooking.count({
        where: { groomerId, status: 'CONFIRMED' },
      }),
    ).toBe(1);
  });

  it('[TC-BOOK-012] blocks availability using an existing booking from another branch', async () => {
    // Prepare a valid booking at the other branch first.
    await prisma.groomerWorkingInterval.updateMany({
      where: { groomerId, branchId },
      data: { branchId: otherBranchId },
    });

    await customer
      .post('/bookings')
      .send({
        ...bookingPayload(),
        branchId: otherBranchId,
      })
      .expect(201);

    // Model a later weekly schedule at this branch.
    // Direct fixture writes bypass schedule-change protection intentionally.
    await prisma.groomerWorkingInterval.updateMany({
      where: { groomerId, branchId: otherBranchId },
      data: { branchId },
    });

    const available = await customer
      .post('/availability/search')
      .send(payload())
      .expect(200);

    const availableStarts = starts(available.body);

    expect(availableStarts).not.toContain(localTime('09:00'));
    expect(availableStarts).not.toContain(localTime('10:00'));
    expect(availableStarts).toContain(localTime('10:15'));

    await customer.post('/bookings').send(bookingPayload()).expect(409);

    const bookings = await prisma.groomingBooking.findMany({
      where: { groomerId },
      select: { branchId: true },
    });

    expect(bookings).toEqual([{ branchId: otherBranchId }]);
  });
  it('[TC-BOOK-READ-001] lists and paginates only the current customer bookings', async () => {
    await customer.post('/bookings').send(bookingPayload()).expect(201);

    await customer
      .post('/bookings')
      .send({
        ...bookingPayload(),
        startsAt: localTime('13:00'),
      })
      .expect(201);

    const first = await customer
      .get('/bookings?page=1&limit=1')
      .expect(200)
      .expect('Cache-Control', 'no-store');

    const second = await customer.get('/bookings?page=2&limit=1').expect(200);

    const empty = await customer.get('/bookings?page=3&limit=1').expect(200);

    expect(first.body as unknown).toMatchObject({
      items: [
        {
          petId,
          startsAt: localTime('13:00'),
        },
      ],
      pagination: {
        page: 1,
        limit: 1,
        total: 2,
        totalPages: 2,
      },
    });

    expect(second.body as unknown).toMatchObject({
      items: [
        {
          petId,
          startsAt: localTime('09:00'),
        },
      ],
      pagination: {
        page: 2,
        limit: 1,
        total: 2,
        totalPages: 2,
      },
    });

    expect(empty.body as unknown).toEqual({
      items: [],
      pagination: {
        page: 3,
        limit: 1,
        total: 2,
        totalPages: 2,
      },
    });
  });

  it('[TC-BOOK-READ-002] reads booking details without private account fields', async () => {
    await customer.post('/bookings').send(bookingPayload()).expect(201);

    const booking = await prisma.groomingBooking.findFirstOrThrow({
      where: { groomerId },
      select: { id: true },
    });

    const response = await customer
      .get(`/bookings/${booking.id}`)
      .expect(200)
      .expect('Cache-Control', 'no-store');

    expect(response.body as unknown).toMatchObject({
      id: booking.id,
      petName: 'Availability Dog',
      petWeightKg: 5,
      totalPriceSatang: 40000,
      totalDurationMinutes: 55,
      branch: { id: branchId },
      groomer: { id: groomerId },
    });

    const body = readRecord(response.body);
    const groomer = readRecord(body.groomer);

    expect(body).not.toHaveProperty('ownerId');
    expect(body).not.toHaveProperty('owner');
    expect(Object.keys(groomer).sort()).toEqual(['displayName', 'id']);
  });

  it('[TC-BOOK-READ-003] hides another customer booking from detail and list endpoints', async () => {
    await customer.post('/bookings').send(bookingPayload()).expect(201);

    const booking = await prisma.groomingBooking.findFirstOrThrow({
      where: { groomerId },
      select: { id: true },
    });

    const otherCustomer = request.agent(app.getHttpServer());

    await otherCustomer
      .post('/auth/login')
      .send({
        email: `availability-other-${runId}@example.com`,
        password,
      })
      .expect(200);

    await otherCustomer.get(`/bookings/${booking.id}`).expect(404);

    const listed = await otherCustomer.get('/bookings').expect(200);

    expect(listed.body as unknown).toEqual({
      items: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    });
  });

  it('[TC-BOOK-READ-004] requires a session for both read endpoints', async () => {
    await request(app.getHttpServer()).get('/bookings').expect(401);

    await request(app.getHttpServer())
      .get(`/bookings/${randomUUID()}`)
      .expect(401);
  });

  it.each([
    '/bookings?page=0',
    '/bookings?page=abc',
    '/bookings?limit=101',
    '/bookings?limit=1.5',
    '/bookings/not-a-uuid',
  ])('[TC-BOOK-READ-005] rejects invalid input: %s', async (path) => {
    await customer.get(path).expect(400);
  });

  it('[TC-BOOK-READ-006] preserves booking pet snapshots after profile changes and archival', async () => {
    await customer.post('/bookings').send(bookingPayload()).expect(201);

    const booking = await prisma.groomingBooking.findFirstOrThrow({
      where: { groomerId },
      select: { id: true },
    });

    try {
      await prisma.pet.update({
        where: { id: petId },
        data: {
          name: 'Changed Name',
          weightKg: 8,
          archivedAt: new Date(),
        },
      });

      const response = await customer
        .get(`/bookings/${booking.id}`)
        .expect(200);

      expect(response.body as unknown).toMatchObject({
        petName: 'Availability Dog',
        petWeightKg: 5,
        totalPriceSatang: 40000,
        totalDurationMinutes: 55,
      });
    } finally {
      await prisma.pet.update({
        where: { id: petId },
        data: {
          name: 'Availability Dog',
          weightKg: 5,
          archivedAt: null,
        },
      });
    }
  });
  it('[TC-CANCEL-001] cancels a booking, preserves its items and releases its slot', async () => {
    await customer.post('/bookings').send(bookingPayload()).expect(201);

    const before = await prisma.groomingBooking.findFirstOrThrow({
      where: { groomerId },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });

    const response = await customer
      .post(`/bookings/${before.id}/cancel`)
      .expect(200)
      .expect('Cache-Control', 'no-store');

    expect(response.body as unknown).toMatchObject({
      id: before.id,
      status: 'CANCELLED',
    });

    const after = await prisma.groomingBooking.findUniqueOrThrow({
      where: { id: before.id },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });

    expect(after.status).toBe('CANCELLED');
    expect(after.items).toEqual(before.items);
    expect(after.totalPriceSatang).toBe(before.totalPriceSatang);
    expect(after.startsAt).toEqual(before.startsAt);
    expect(after.occupiedEndsAt).toEqual(before.occupiedEndsAt);

    const detail = await customer.get(`/bookings/${before.id}`).expect(200);

    expect(detail.body as unknown).toMatchObject({
      status: 'CANCELLED',
      totalPriceSatang: 40000,
    });

    const available = await customer
      .post('/availability/search')
      .send(payload())
      .expect(200);

    expect(starts(available.body)).toContain(localTime('09:00'));

    await customer.post('/bookings').send(bookingPayload()).expect(201);

    expect(
      await prisma.groomingBooking.count({
        where: { groomerId, status: 'CONFIRMED' },
      }),
    ).toBe(1);

    expect(
      await prisma.groomingBooking.count({
        where: { groomerId, status: 'CANCELLED' },
      }),
    ).toBe(1);
  });

  it('[TC-CANCEL-002] repeated cancellation preserves updatedAt', async () => {
    await customer.post('/bookings').send(bookingPayload()).expect(201);

    const booking = await prisma.groomingBooking.findFirstOrThrow({
      where: { groomerId },
      select: { id: true },
    });

    const path = `/bookings/${booking.id}/cancel`;

    const first = await customer.post(path).expect(200);

    const stored = await prisma.groomingBooking.findUniqueOrThrow({
      where: { id: booking.id },
      select: { updatedAt: true },
    });

    const second = await customer.post(path).expect(200);

    expect(second.body as unknown).toEqual(first.body as unknown);

    expect(
      await prisma.groomingBooking.findUniqueOrThrow({
        where: { id: booking.id },
        select: { updatedAt: true },
      }),
    ).toEqual(stored);
  });

  it('[TC-CANCEL-003] rejects cancellation without a session', async () => {
    await customer.post('/bookings').send(bookingPayload()).expect(201);

    const booking = await prisma.groomingBooking.findFirstOrThrow({
      where: { groomerId },
    });

    await request(app.getHttpServer())
      .post(`/bookings/${booking.id}/cancel`)
      .expect(401);

    expect(
      await prisma.groomingBooking.findUniqueOrThrow({
        where: { id: booking.id },
      }),
    ).toEqual(booking);
  });

  it('[TC-CANCEL-004] hides another customer booking and preserves it', async () => {
    await customer.post('/bookings').send(bookingPayload()).expect(201);

    const booking = await prisma.groomingBooking.findFirstOrThrow({
      where: { groomerId },
    });

    const otherCustomer = request.agent(app.getHttpServer());

    await otherCustomer
      .post('/auth/login')
      .send({
        email: `availability-other-${runId}@example.com`,
        password,
      })
      .expect(200);

    await otherCustomer.post(`/bookings/${booking.id}/cancel`).expect(404);

    expect(
      await prisma.groomingBooking.findUniqueOrThrow({
        where: { id: booking.id },
      }),
    ).toEqual(booking);
  });

  it('[TC-CANCEL-005] rejects an unknown or malformed booking ID', async () => {
    await customer.post(`/bookings/${randomUUID()}/cancel`).expect(404);

    await customer.post('/bookings/not-a-uuid/cancel').expect(400);
  });

  it('[TC-CANCEL-006] allows concurrent cancellation requests without repeated updates', async () => {
    await customer.post('/bookings').send(bookingPayload()).expect(201);

    const booking = await prisma.groomingBooking.findFirstOrThrow({
      where: { groomerId },
      select: { id: true },
    });

    const path = `/bookings/${booking.id}/cancel`;

    const responses = await Promise.all([
      customer.post(path),
      customer.post(path),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);

    expect(responses[0].body as unknown).toEqual(responses[1].body as unknown);

    expect(
      await prisma.groomingBooking.count({
        where: { groomerId, status: 'CANCELLED' },
      }),
    ).toBe(1);
  });
  it('[TC-CANCEL-007] rejects cancellation after the booking has started', async () => {
    await customer.post('/bookings').send(bookingPayload()).expect(201);

    const booking = await prisma.groomingBooking.findFirstOrThrow({
      where: { groomerId },
      select: {
        id: true,
        totalDurationMinutes: true,
        bufferMinutes: true,
      },
    });

    // Move only this fixture into the past, preserving DB constraints.
    const stepMs = 15 * 60_000;
    const startsAt = new Date(
      Math.floor(Date.now() / stepMs) * stepMs - stepMs,
    );
    const serviceEndsAt = new Date(
      startsAt.getTime() + booking.totalDurationMinutes * 60_000,
    );
    const occupiedEndsAt = new Date(
      serviceEndsAt.getTime() + booking.bufferMinutes * 60_000,
    );

    const before = await prisma.groomingBooking.update({
      where: { id: booking.id },
      data: {
        startsAt,
        serviceEndsAt,
        occupiedEndsAt,
      },
    });

    await customer.post(`/bookings/${booking.id}/cancel`).expect(409);

    expect(
      await prisma.groomingBooking.findUniqueOrThrow({
        where: { id: booking.id },
      }),
    ).toEqual(before);
  });

  it.each(['COMPLETED', 'NO_SHOW'] as const)(
    '[TC-CANCEL-008] rejects cancellation of a %s booking',
    async (status) => {
      await customer.post('/bookings').send(bookingPayload()).expect(201);

      const booking = await prisma.groomingBooking.findFirstOrThrow({
        where: { groomerId },
        select: { id: true },
      });

      // Prepare a terminal-status fixture directly.
      const before = await prisma.groomingBooking.update({
        where: { id: booking.id },
        data: { status },
      });

      await customer.post(`/bookings/${booking.id}/cancel`).expect(409);

      expect(
        await prisma.groomingBooking.findUniqueOrThrow({
          where: { id: booking.id },
        }),
      ).toEqual(before);
    },
  );
});
