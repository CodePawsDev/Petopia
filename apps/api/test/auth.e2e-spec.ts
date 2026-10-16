import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';

describe('Customer registration (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const testEmails = new Set<string>();

  function createPayload() {
    const email = `e2e-${randomUUID()}@example.com`;
    testEmails.add(email);

    return {
      email,
      password: 'PetopiaTest2026!',
      displayName: 'Registration Test',
    };
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);

    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    try {
      if (prisma && testEmails.size > 0) {
        await prisma.user.deleteMany({
          where: {
            email: { in: [...testEmails] },
          },
        });
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('[TC-AUTH-001] should normalize input, store a password hash and return only public fields', async () => {
    const payload = createPayload();

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        ...payload,
        email: `  ${payload.email.toUpperCase()}  `,
        displayName: '  Registration Test  ',
      })
      .expect(201);

    const body = response.body as Record<string, unknown>;

    expect(Object.keys(body).sort()).toEqual(
      ['id', 'email', 'displayName', 'createdAt'].sort(),
    );
    expect(body.email).toBe(payload.email);
    expect(body.displayName).toBe('Registration Test');
    expect(body.id).toEqual(expect.any(String));
    expect(body.createdAt).toEqual(expect.any(String));

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: payload.email },
    });

    expect(user.id).toBe(body.id);
    expect(user.passwordHash).not.toBe(payload.password);
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await argon2.verify(user.passwordHash, payload.password)).toBe(true);
    expect(await argon2.verify(user.passwordHash, 'WrongPassword!')).toBe(
      false,
    );
  });

  it('[TC-AUTH-002] should reject the same email regardless of letter case', async () => {
    const payload = createPayload();

    await request(app.getHttpServer())
      .post('/auth/register')
      .send(payload)
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        ...payload,
        email: payload.email.toUpperCase(),
      })
      .expect(409)
      .expect((response) => {
        const body = response.body as Record<string, unknown>;
        expect(body.message).toBe('Email already registered');
      });

    expect(
      await prisma.user.count({
        where: { email: payload.email },
      }),
    ).toBe(1);
  });

  it.each([
    {
      caseId: 'TC-AUTH-004',
      name: 'invalid email',
      overrides: { email: 'not-an-email' },
    },
    {
      caseId: 'TC-AUTH-005',
      name: 'password shorter than 8 characters',
      overrides: { password: 'short' },
    },
    {
      caseId: 'TC-AUTH-006',
      name: 'a client-supplied staff role',
      overrides: { role: 'BRANCH_MANAGER' },
    },
  ])(
    '[$caseId] should reject $name without creating a user',
    async ({ overrides }) => {
      const payload = createPayload();
      const input = { ...payload, ...overrides };
      testEmails.add(input.email);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(input)
        .expect(400);

      expect(
        await prisma.user.count({
          where: { email: input.email },
        }),
      ).toBe(0);
    },
  );

  it('[TC-AUTH-003] should create only one user when the same email registers concurrently', async () => {
    const payload = createPayload();

    const responses = await Promise.all([
      request(app.getHttpServer()).post('/auth/register').send(payload),
      request(app.getHttpServer()).post('/auth/register').send(payload),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);

    expect(
      await prisma.user.count({
        where: { email: payload.email },
      }),
    ).toBe(1);
  });
});
