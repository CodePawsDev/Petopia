import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  GroomingServiceKind,
  PetSpecies,
} from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';

describe('Service quotes (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let cookie: string;
  let userId: string;
  let branchId: string;
  let bathId: string;
  let haircutId: string;
  let nailId: string;

  const petId = randomUUID();
  const email = `e2e-quotes-${randomUUID()}@example.com`;
  const password = 'PetopiaTest2026!';

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();

    prisma = app.get(PrismaService);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password,
        displayName: 'Quote Test',
      })
      .expect(201);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { id: true },
    });

    userId = user.id;

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const rawCookies: unknown = login.headers['set-cookie'];

    if (
      !Array.isArray(rawCookies) ||
      !rawCookies.every(
        (value: unknown): value is string => typeof value === 'string',
      )
    ) {
      throw new Error('Expected session cookies');
    }

    const sessionCookie = rawCookies.find((value) =>
      value.startsWith('petopia.sid='),
    );

    if (!sessionCookie) {
      throw new Error('Expected petopia.sid cookie');
    }

    cookie = sessionCookie.split(';')[0];

    const branch = await prisma.branch.findUniqueOrThrow({
      where: { code: 'GROOMING-ARI' },
      select: { id: true, businessUnitId: true },
    });

    branchId = branch.id;

    const services = await prisma.groomingService.findMany({
      where: {
        businessUnitId: branch.businessUnitId,
        active: true,
      },
      select: { id: true, kind: true },
    });

    function serviceId(kind: GroomingServiceKind): string {
      const service = services.find((item) => item.kind === kind);

      if (!service) {
        throw new Error(`Missing seeded service: ${kind}`);
      }

      return service.id;
    }

    bathId = serviceId(GroomingServiceKind.BATH);
    haircutId = serviceId(GroomingServiceKind.BATH_WITH_HAIRCUT);
    nailId = serviceId(GroomingServiceKind.NAIL_TRIMMING);

    await prisma.pet.create({
      data: {
        id: petId,
        ownerId: userId,
        name: 'Quote Dog',
        species: PetSpecies.DOG,
        weightKg: 5,
      },
    });
  }, 30_000);

  afterAll(async () => {
    try {
      if (prisma) {
        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });

        if (user) {
          await prisma.session.deleteMany({
            where: {
              sess: {
                path: ['userId'],
                equals: user.id,
              },
            },
          });

          await prisma.pet.deleteMany({
            where: { ownerId: user.id },
          });

          await prisma.user.delete({
            where: { id: user.id },
          });
        }
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('[TC-QUOTE-001] should calculate multiple services using stored pet weight and catalog prices', async () => {
    const response = await request(app.getHttpServer())
      .post('/quotes')
      .set('Cookie', cookie)
      .send({
        branchId,
        petId,
        serviceIds: [bathId, nailId],
      })
      .expect(200)
      .expect('Cache-Control', 'no-store');

    const body = response.body as Record<string, unknown>;

    expect(body).toEqual({
      branch: expect.objectContaining({ id: branchId }) as unknown,
      pet: {
        id: petId,
        name: 'Quote Dog',
        species: 'DOG',
        weightKg: 5,
      },
      currency: 'THB',
      items: expect.arrayContaining([
        expect.objectContaining({
          serviceId: bathId,
          priceSatang: 30_000,
          durationMinutes: 45,
          requiresAssessment: false,
        }),
        expect.objectContaining({
          serviceId: nailId,
          priceSatang: 10_000,
          durationMinutes: 10,
          requiresAssessment: false,
        }),
      ]) as unknown,
      totalPriceSatang: 40_000,
      totalDurationMinutes: 55,
      requiresAssessment: false,
    });

    expect(body.items).toHaveLength(2);
  });

  it('[TC-QUOTE-002] should reject requests without a session', async () => {
    await request(app.getHttpServer())
      .post('/quotes')
      .send({
        branchId,
        petId,
        serviceIds: [bathId],
      })
      .expect(401);
  });

  it('[TC-QUOTE-003] should reject duplicate services', async () => {
    await request(app.getHttpServer())
      .post('/quotes')
      .set('Cookie', cookie)
      .send({
        branchId,
        petId,
        serviceIds: [bathId, bathId],
      })
      .expect(400);
  });

  it('[TC-QUOTE-004] should reject bath combined with bath and haircut', async () => {
    const response = await request(app.getHttpServer())
      .post('/quotes')
      .set('Cookie', cookie)
      .send({
        branchId,
        petId,
        serviceIds: [bathId, haircutId],
      })
      .expect(400);

    const body = response.body as Record<string, unknown>;

    expect(body.message).toBe(
      'Bath and bath with haircut cannot be selected together',
    );
  });
  it('[TC-QUOTE-005] should reject another user requesting a quote for the pet', async () => {
    const otherEmail = `e2e-quote-other-${randomUUID()}@example.com`;
    const agent = request.agent(app.getHttpServer());

    try {
      await agent
        .post('/auth/register')
        .send({
          email: otherEmail,
          password,
          displayName: 'Other Customer',
        })
        .expect(201);

      await agent
        .post('/auth/login')
        .send({ email: otherEmail, password })
        .expect(200);

      const response = await agent
        .post('/quotes')
        .send({
          branchId,
          petId,
          serviceIds: [bathId],
        })
        .expect(404);

      const body = response.body as Record<string, unknown>;

      expect(body.message).toBe('Pet not found');
    } finally {
      const otherUser = await prisma.user.findUnique({
        where: { email: otherEmail },
        select: { id: true },
      });

      if (otherUser) {
        await prisma.session.deleteMany({
          where: {
            sess: {
              path: ['userId'],
              equals: otherUser.id,
            },
          },
        });

        await prisma.user.delete({
          where: { id: otherUser.id },
        });
      }
    }
  });

  it('[TC-QUOTE-006] should reject an archived pet', async () => {
    try {
      await prisma.pet.update({
        where: { id: petId },
        data: { archivedAt: new Date() },
      });

      const response = await request(app.getHttpServer())
        .post('/quotes')
        .set('Cookie', cookie)
        .send({
          branchId,
          petId,
          serviceIds: [bathId],
        })
        .expect(404);

      const body = response.body as Record<string, unknown>;

      expect(body.message).toBe('Pet not found');
    } finally {
      await prisma.pet.update({
        where: { id: petId },
        data: { archivedAt: null },
      });
    }
  });

  it.each([
    { weight: 5, priceSatang: 30_000, durationMinutes: 45 },
    { weight: 5.001, priceSatang: 40_000, durationMinutes: 60 },
    { weight: 80, priceSatang: 125_000, durationMinutes: 150 },
  ])(
    '[TC-QUOTE-007] should select the correct bath rate at $weight kg',
    async ({ weight, priceSatang, durationMinutes }) => {
      try {
        await prisma.pet.update({
          where: { id: petId },
          data: { weightKg: weight },
        });

        const response = await request(app.getHttpServer())
          .post('/quotes')
          .set('Cookie', cookie)
          .send({
            branchId,
            petId,
            serviceIds: [bathId],
          })
          .expect(200);

        const body = response.body as Record<string, unknown>;

        expect(body.totalPriceSatang).toBe(priceSatang);
        expect(body.totalDurationMinutes).toBe(durationMinutes);
        expect(body.items).toHaveLength(1);
        expect(body.pet).toEqual({
          id: petId,
          name: 'Quote Dog',
          species: 'DOG',
          weightKg: weight,
        });
      } finally {
        await prisma.pet.update({
          where: { id: petId },
          data: { weightKg: 5 },
        });
      }
    },
  );

  it('[TC-QUOTE-008] should reject weight above the supported range', async () => {
    try {
      await prisma.pet.update({
        where: { id: petId },
        data: { weightKg: 80.001 },
      });

      const response = await request(app.getHttpServer())
        .post('/quotes')
        .set('Cookie', cookie)
        .send({
          branchId,
          petId,
          serviceIds: [bathId],
        })
        .expect(400);

      const body = response.body as Record<string, unknown>;

      expect(body.message).toBe(
        'A selected service has no unique rate for this pet; contact the branch for assessment',
      );
    } finally {
      await prisma.pet.update({
        where: { id: petId },
        data: { weightKg: 5 },
      });
    }
  });
  it.each([
    {
      species: PetSpecies.CAT,
      weight: 15,
      expectedStatus: 200,
      requiresAssessment: false,
    },
    {
      species: PetSpecies.CAT,
      weight: 15.001,
      expectedStatus: 400,
      requiresAssessment: false,
    },
    {
      species: PetSpecies.RABBIT,
      weight: 8,
      expectedStatus: 200,
      requiresAssessment: true,
    },
    {
      species: PetSpecies.RABBIT,
      weight: 8.001,
      expectedStatus: 400,
      requiresAssessment: true,
    },
  ])(
    '[TC-QUOTE-018] checks the $species weight limit at $weight kg',
    async ({ species, weight, expectedStatus, requiresAssessment }) => {
      try {
        await prisma.pet.update({
          where: { id: petId },
          data: {
            species,
            weightKg: weight,
          },
        });

        const response = await request(app.getHttpServer())
          .post('/quotes')
          .set('Cookie', cookie)
          .send({
            branchId,
            petId,
            serviceIds: [bathId],
          })
          .expect(expectedStatus);

        if (expectedStatus === 200) {
          expect(response.body as unknown).toMatchObject({
            pet: {
              id: petId,
              species,
              weightKg: weight,
            },
            requiresAssessment,
            items: [
              {
                serviceId: bathId,
                requiresAssessment,
              },
            ],
          });
        } else {
          expect(response.body as unknown).toMatchObject({
            message:
              'A selected service has no unique rate for this pet; contact the branch for assessment',
          });
        }
      } finally {
        await prisma.pet.update({
          where: { id: petId },
          data: {
            species: PetSpecies.DOG,
            weightKg: 5,
          },
        });
      }
    },
  );

  it('[TC-QUOTE-009] should reject a pet without recorded weight', async () => {
    try {
      await prisma.pet.update({
        where: { id: petId },
        data: { weightKg: null },
      });

      const response = await request(app.getHttpServer())
        .post('/quotes')
        .set('Cookie', cookie)
        .send({
          branchId,
          petId,
          serviceIds: [bathId],
        })
        .expect(400);

      const body = response.body as Record<string, unknown>;

      expect(body.message).toBe('Pet weight is required to calculate a quote');
    } finally {
      await prisma.pet.update({
        where: { id: petId },
        data: { weightKg: 5 },
      });
    }
  });
  it.each([
    { name: 'an empty service list', serviceIds: [] },
    { name: 'a malformed service ID', serviceIds: ['invalid-id'] },
  ])('[TC-QUOTE-010] should reject $name', async ({ serviceIds }) => {
    await request(app.getHttpServer())
      .post('/quotes')
      .set('Cookie', cookie)
      .send({
        branchId,
        petId,
        serviceIds,
      })
      .expect(400);
  });

  it('[TC-QUOTE-011] should reject client-supplied prices and weight', async () => {
    await request(app.getHttpServer())
      .post('/quotes')
      .set('Cookie', cookie)
      .send({
        branchId,
        petId,
        serviceIds: [bathId],
        totalPriceSatang: 1,
        weightKg: 1,
      })
      .expect(400);
  });

  it('[TC-QUOTE-012] should flag rabbit services for assessment', async () => {
    try {
      await prisma.pet.update({
        where: { id: petId },
        data: {
          species: PetSpecies.RABBIT,
          weightKg: 2,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/quotes')
        .set('Cookie', cookie)
        .send({
          branchId,
          petId,
          serviceIds: [bathId, nailId],
        })
        .expect(200);

      const body = response.body as Record<string, unknown>;

      expect(body.totalPriceSatang).toBe(45_000);
      expect(body.totalDurationMinutes).toBe(55);
      expect(body.requiresAssessment).toBe(true);
      expect(body.items).toHaveLength(2);

      expect(body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            serviceId: bathId,
            priceSatang: 35_000,
            requiresAssessment: true,
          }),
          expect.objectContaining({
            serviceId: nailId,
            priceSatang: 10_000,
            requiresAssessment: true,
          }),
        ]),
      );
    } finally {
      await prisma.pet.update({
        where: { id: petId },
        data: {
          species: PetSpecies.DOG,
          weightKg: 5,
        },
      });
    }
  });

  it('[TC-QUOTE-013] should reject an unknown service instead of returning a partial quote', async () => {
    const response = await request(app.getHttpServer())
      .post('/quotes')
      .set('Cookie', cookie)
      .send({
        branchId,
        petId,
        serviceIds: [bathId, randomUUID()],
      })
      .expect(400);

    const body = response.body as Record<string, unknown>;

    expect(body.message).toBe('One or more selected services are unavailable');
  });
  it('[TC-QUOTE-014] should reject an inactive service', async () => {
    const service = await prisma.groomingService.findUniqueOrThrow({
      where: { id: bathId },
      select: { active: true },
    });

    try {
      await prisma.groomingService.update({
        where: { id: bathId },
        data: { active: false },
      });

      const response = await request(app.getHttpServer())
        .post('/quotes')
        .set('Cookie', cookie)
        .send({
          branchId,
          petId,
          serviceIds: [bathId, nailId],
        })
        .expect(400);

      const body = response.body as Record<string, unknown>;

      expect(body.message).toBe(
        'One or more selected services are unavailable',
      );
    } finally {
      await prisma.groomingService.update({
        where: { id: bathId },
        data: { active: service.active },
      });
    }
  });

  it('[TC-QUOTE-015] should reject an inactive matching rate', async () => {
    const rate = await prisma.groomingServiceRate.findFirstOrThrow({
      where: {
        serviceId: bathId,
        species: PetSpecies.DOG,
        active: true,
        minWeightKg: { lt: 5 },
        maxWeightKg: { gte: 5 },
      },
      select: { id: true, active: true },
    });

    try {
      await prisma.groomingServiceRate.update({
        where: { id: rate.id },
        data: { active: false },
      });

      const response = await request(app.getHttpServer())
        .post('/quotes')
        .set('Cookie', cookie)
        .send({
          branchId,
          petId,
          serviceIds: [bathId, nailId],
        })
        .expect(400);

      const body = response.body as Record<string, unknown>;

      expect(body.message).toBe(
        'A selected service has no unique rate for this pet; contact the branch for assessment',
      );
    } finally {
      await prisma.groomingServiceRate.update({
        where: { id: rate.id },
        data: { active: rate.active },
      });
    }
  });

  it('[TC-QUOTE-016] should reject an inactive branch', async () => {
    const branch = await prisma.branch.findUniqueOrThrow({
      where: { id: branchId },
      select: { active: true },
    });

    try {
      await prisma.branch.update({
        where: { id: branchId },
        data: { active: false },
      });

      const response = await request(app.getHttpServer())
        .post('/quotes')
        .set('Cookie', cookie)
        .send({
          branchId,
          petId,
          serviceIds: [bathId],
        })
        .expect(404);

      const body = response.body as Record<string, unknown>;

      expect(body.message).toBe('Branch not found');
    } finally {
      await prisma.branch.update({
        where: { id: branchId },
        data: { active: branch.active },
      });
    }
  });

  it('[TC-QUOTE-017] should reject an inactive business unit', async () => {
    const branch = await prisma.branch.findUniqueOrThrow({
      where: { id: branchId },
      select: { businessUnitId: true },
    });

    const businessUnit = await prisma.businessUnit.findUniqueOrThrow({
      where: { id: branch.businessUnitId },
      select: { id: true, active: true },
    });

    try {
      await prisma.businessUnit.update({
        where: { id: businessUnit.id },
        data: { active: false },
      });

      const response = await request(app.getHttpServer())
        .post('/quotes')
        .set('Cookie', cookie)
        .send({
          branchId,
          petId,
          serviceIds: [bathId],
        })
        .expect(404);

      const body = response.body as Record<string, unknown>;

      expect(body.message).toBe('Branch not found');
    } finally {
      await prisma.businessUnit.update({
        where: { id: businessUnit.id },
        data: { active: businessUnit.active },
      });
    }
  });
});
