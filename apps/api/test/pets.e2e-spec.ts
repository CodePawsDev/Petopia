import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';

describe('Pet profiles (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerId: string;

  const email = `e2e-pets-${randomUUID()}@example.com`;
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
        displayName: 'Pet Owner Test',
      })
      .expect(201);

    const owner = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { id: true },
    });

    ownerId = owner.id;
  });

  afterAll(async () => {
    try {
      if (prisma) {
        const owner = await prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });

        if (owner) {
          await prisma.session.deleteMany({
            where: {
              sess: {
                path: ['userId'],
                equals: owner.id,
              },
            },
          });

          await prisma.pet.deleteMany({
            where: { ownerId: owner.id },
          });

          await prisma.user.delete({
            where: { id: owner.id },
          });
        }
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('[TC-PET-001] should create a pet with normalized input and session ownership', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent.post('/auth/login').send({ email, password }).expect(200);

    const response = await agent
      .post('/pets')
      .send({
        name: '  Mochi  ',
        species: 'DOG',
        breed: '  Shih Tzu  ',
        birthDate: '2023-05-20',
        weightKg: 4.5,
        careNotes: '  Afraid of dryer noise  ',
      })
      .expect(201)
      .expect('Cache-Control', 'no-store');

    const body = response.body as Record<string, unknown>;

    expect(body).toEqual({
      id: expect.any(String) as unknown,
      name: 'Mochi',
      species: 'DOG',
      breed: 'Shih Tzu',
      birthDate: '2023-05-20',
      weightKg: 4.5,
      careNotes: 'Afraid of dryer noise',
      archivedAt: null,
      createdAt: expect.any(String) as unknown,
      updatedAt: expect.any(String) as unknown,
    });

    if (typeof body.id !== 'string') {
      throw new Error('Expected a pet ID');
    }

    const pet = await prisma.pet.findUniqueOrThrow({
      where: { id: body.id },
    });

    expect(pet.ownerId).toBe(ownerId);
    expect(pet.weightKg?.toNumber()).toBe(4.5);

    await agent.post('/auth/logout').expect(204);
  });

  it('[TC-PET-002] should update supplied fields, preserve omitted fields and clear optional fields', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent.post('/auth/login').send({ email, password }).expect(200);

    const pet = await prisma.pet.create({
      data: {
        ownerId,
        name: 'Update Test',
        species: 'CAT',
        breed: 'Domestic Shorthair',
        birthDate: new Date('2023-05-20T00:00:00.000Z'),
        weightKg: 4,
        careNotes: 'Original note',
      },
    });

    const response = await agent
      .patch(`/pets/${pet.id}`)
      .send({
        name: '  Updated Cat  ',
        weightKg: 4.8,
      })
      .expect(200)
      .expect('Cache-Control', 'no-store');

    expect(response.body).toMatchObject({
      id: pet.id,
      name: 'Updated Cat',
      species: 'CAT',
      breed: 'Domestic Shorthair',
      birthDate: '2023-05-20',
      weightKg: 4.8,
      careNotes: 'Original note',
    });

    const clearedResponse = await agent
      .patch(`/pets/${pet.id}`)
      .send({
        breed: null,
        birthDate: null,
        weightKg: null,
        careNotes: null,
      })
      .expect(200);

    expect(clearedResponse.body).toMatchObject({
      id: pet.id,
      name: 'Updated Cat',
      species: 'CAT',
      breed: null,
      birthDate: null,
      weightKg: null,
      careNotes: null,
    });

    const stored = await prisma.pet.findUniqueOrThrow({
      where: { id: pet.id },
    });

    expect(stored.breed).toBeNull();
    expect(stored.birthDate).toBeNull();
    expect(stored.weightKg).toBeNull();
    expect(stored.careNotes).toBeNull();

    await agent.post('/auth/logout').expect(204);
  });

  it('[TC-PET-003] should archive and restore the same pet without deleting its data', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent.post('/auth/login').send({ email, password }).expect(200);

    const pet = await prisma.pet.create({
      data: {
        ownerId,
        name: 'Archive Test',
        species: 'RABBIT',
        careNotes: 'Handle gently',
      },
    });

    const archivedResponse = await agent
      .post(`/pets/${pet.id}/archive`)
      .expect(200)
      .expect('Cache-Control', 'no-store');

    const archivedBody = archivedResponse.body as Record<string, unknown>;

    expect(archivedBody.archivedAt).toEqual(expect.any(String));

    const repeatedArchive = await agent
      .post(`/pets/${pet.id}/archive`)
      .expect(200);

    expect((repeatedArchive.body as Record<string, unknown>).archivedAt).toBe(
      archivedBody.archivedAt,
    );

    const activeResponse = await agent.get('/pets').expect(200);

    expect(activeResponse.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: pet.id })]),
    );

    const archivedListResponse = await agent
      .get('/pets?archived=true')
      .expect(200);

    expect(archivedListResponse.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: pet.id })]),
    );

    await agent
      .get(`/pets/${pet.id}`)
      .expect(200)
      .expect('Cache-Control', 'no-store');

    const restoredResponse = await agent
      .post(`/pets/${pet.id}/restore`)
      .expect(200);

    expect(restoredResponse.body).toMatchObject({
      id: pet.id,
      name: 'Archive Test',
      species: 'RABBIT',
      careNotes: 'Handle gently',
      archivedAt: null,
    });

    await agent.post(`/pets/${pet.id}/restore`).expect(200);

    const restoredList = await agent.get('/pets').expect(200);

    expect(restoredList.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: pet.id,
          archivedAt: null,
        }),
      ]),
    );

    const archivedAfterRestore = await agent
      .get('/pets?archived=true')
      .expect(200);

    expect(archivedAfterRestore.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: pet.id })]),
    );

    const stored = await prisma.pet.findUniqueOrThrow({
      where: { id: pet.id },
    });

    expect(stored.archivedAt).toBeNull();
    expect(stored.careNotes).toBe('Handle gently');

    await agent.post('/auth/logout').expect(204);
  });

  it('[TC-PET-004] should reject an invalid archived query', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent.post('/auth/login').send({ email, password }).expect(200);

    await agent.get('/pets?archived=abc').expect(400);

    await agent.post('/auth/logout').expect(204);
  });

  it.each([
    {
      caseId: 'TC-PET-005',
      name: 'a blank name',
      overrides: { name: '   ' },
    },
    {
      caseId: 'TC-PET-006',
      name: 'an unsupported species',
      overrides: { species: 'BIRD' },
    },
    {
      caseId: 'TC-PET-007',
      name: 'zero weight',
      overrides: { weightKg: 0 },
    },
    {
      caseId: 'TC-PET-008',
      name: 'weight with more than three decimal places',
      overrides: { weightKg: 4.1234 },
    },
    {
      caseId: 'TC-PET-009',
      name: 'an invalid calendar date',
      overrides: { birthDate: '2023-02-30' },
    },
    {
      caseId: 'TC-PET-010',
      name: 'a future birth date',
      overrides: { birthDate: '2999-01-01' },
    },
    {
      caseId: 'TC-PET-011',
      name: 'a client-supplied owner',
      overrides: { ownerId: randomUUID() },
    },
  ])(
    '[$caseId] should reject $name without creating a pet',
    async ({ overrides }) => {
      const agent = request.agent(app.getHttpServer());

      await agent.post('/auth/login').send({ email, password }).expect(200);

      const countBefore = await prisma.pet.count({
        where: { ownerId },
      });

      await agent
        .post('/pets')
        .send({
          name: 'Validation Test',
          species: 'DOG',
          ...overrides,
        })
        .expect(400);

      expect(
        await prisma.pet.count({
          where: { ownerId },
        }),
      ).toBe(countBefore);

      await agent.post('/auth/logout').expect(204);
    },
  );

  it('[TC-PET-012] should reject invalid updates without changing stored data', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent.post('/auth/login').send({ email, password }).expect(200);

    const pet = await prisma.pet.create({
      data: {
        ownerId,
        name: 'Unchanged Pet',
        species: 'CAT',
        weightKg: 4,
        careNotes: 'Keep this note',
      },
    });

    const invalidUpdates: Record<string, unknown>[] = [
      { name: null },
      { name: '   ' },
      { species: null },
      { species: 'BIRD' },
      { weightKg: -1 },
      { weightKg: 1000 },
      { birthDate: '2023-02-30' },
      { birthDate: '2999-01-01' },
      { ownerId: randomUUID() },
      { archivedAt: new Date().toISOString() },
    ];

    for (const payload of invalidUpdates) {
      await agent.patch(`/pets/${pet.id}`).send(payload).expect(400);

      const stored = await prisma.pet.findUniqueOrThrow({
        where: { id: pet.id },
      });

      expect(stored).toEqual(pet);
    }

    await agent.post('/auth/logout').expect(204);
  });
  it('[TC-PET-013] should reject all pet endpoints without a session', async () => {
    const pet = await prisma.pet.create({
      data: {
        ownerId,
        name: 'Protected Pet',
        species: 'DOG',
      },
    });

    const countBefore = await prisma.pet.count({
      where: { ownerId },
    });

    await request(app.getHttpServer())
      .post('/pets')
      .send({
        name: 'Unauthorized Pet',
        species: 'CAT',
      })
      .expect(401);

    await request(app.getHttpServer()).get('/pets').expect(401);

    await request(app.getHttpServer()).get('/pets?archived=true').expect(401);

    await request(app.getHttpServer()).get(`/pets/${pet.id}`).expect(401);

    await request(app.getHttpServer())
      .patch(`/pets/${pet.id}`)
      .send({ name: 'Unauthorized Change' })
      .expect(401);

    await request(app.getHttpServer())
      .post(`/pets/${pet.id}/archive`)
      .expect(401);

    await request(app.getHttpServer())
      .post(`/pets/${pet.id}/restore`)
      .expect(401);

    expect(
      await prisma.pet.count({
        where: { ownerId },
      }),
    ).toBe(countBefore);

    const stored = await prisma.pet.findUniqueOrThrow({
      where: { id: pet.id },
    });

    expect(stored).toEqual(pet);
  });
  it('[TC-PET-014] should prevent another account from accessing or modifying owned pets', async () => {
    const otherEmail = `e2e-other-pets-${randomUUID()}@example.com`;
    const otherAgent = request.agent(app.getHttpServer());

    try {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: otherEmail,
          password,
          displayName: 'Other Owner',
        })
        .expect(201);

      await otherAgent
        .post('/auth/login')
        .send({ email: otherEmail, password })
        .expect(200);

      const activePet = await prisma.pet.create({
        data: {
          ownerId,
          name: 'Private Active Pet',
          species: 'DOG',
          careNotes: 'Private care note',
        },
      });

      const archivedPet = await prisma.pet.create({
        data: {
          ownerId,
          name: 'Private Archived Pet',
          species: 'RABBIT',
          archivedAt: new Date(),
        },
      });

      await otherAgent.get('/pets').expect(200).expect([]);
      await otherAgent.get('/pets?archived=true').expect(200).expect([]);

      for (const pet of [activePet, archivedPet]) {
        await otherAgent.get(`/pets/${pet.id}`).expect(404);

        await otherAgent
          .patch(`/pets/${pet.id}`)
          .send({ name: 'Changed by another account' })
          .expect(404);

        await otherAgent.post(`/pets/${pet.id}/archive`).expect(404);

        await otherAgent.post(`/pets/${pet.id}/restore`).expect(404);

        const stored = await prisma.pet.findUniqueOrThrow({
          where: { id: pet.id },
        });

        expect(stored).toEqual(pet);
      }
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

        await prisma.pet.deleteMany({
          where: { ownerId: otherUser.id },
        });

        await prisma.user.delete({
          where: { id: otherUser.id },
        });
      }
    }
  });

  it.each([
    {
      caseId: 'TC-PET-015',
      name: 'an invalid pet ID',
      petId: 'not-a-uuid',
      expectedStatus: 400,
    },
    {
      caseId: 'TC-PET-016',
      name: 'a nonexistent pet ID',
      petId: randomUUID(),
      expectedStatus: 404,
    },
  ])('[$caseId] should reject $name', async ({ petId, expectedStatus }) => {
    const agent = request.agent(app.getHttpServer());

    await agent.post('/auth/login').send({ email, password }).expect(200);

    await agent.get(`/pets/${petId}`).expect(expectedStatus);

    await agent
      .patch(`/pets/${petId}`)
      .send({ name: 'Updated Pet' })
      .expect(expectedStatus);

    await agent.post(`/pets/${petId}/archive`).expect(expectedStatus);

    await agent.post(`/pets/${petId}/restore`).expect(expectedStatus);

    await agent.post('/auth/logout').expect(204);
  });
});
