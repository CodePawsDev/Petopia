import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';

describe('Session authentication (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const email = `e2e-session-${randomUUID()}@example.com`;
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
        displayName: 'Session Test',
      })
      .expect(201);
  });

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

  it('[TC-AUTH-010] should reject requests without an authenticated session', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('[TC-AUTH-007, TC-AUTH-011, TC-AUTH-012] should log in, return the current user and invalidate the session on logout', async () => {
    const agent = request.agent(app.getHttpServer());

    const loginResponse = await agent
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: {
        id: true,
        email: true,
        displayName: true,
      },
    });

    expect(loginResponse.body).toEqual(user);

    const headers = loginResponse.headers as Record<string, unknown>;
    const rawCookies = headers['set-cookie'];

    if (
      !Array.isArray(rawCookies) ||
      !rawCookies.every(
        (value: unknown): value is string => typeof value === 'string',
      )
    ) {
      throw new Error('Expected session cookies in the login response');
    }

    const sessionCookie = rawCookies.find((cookie) =>
      cookie.startsWith('petopia.sid='),
    );

    if (!sessionCookie) {
      throw new Error('Expected a petopia.sid cookie');
    }

    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('SameSite=Lax');

    const oldCookie = sessionCookie.split(';')[0];

    await agent
      .get('/auth/me')
      .expect(200)
      .expect('Cache-Control', 'no-store')
      .expect(user);

    const logoutResponse = await agent.post('/auth/logout').expect(204);

    expect(logoutResponse.text).toBe('');

    await agent.get('/auth/me').expect(401);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', oldCookie)
      .expect(401);

    expect(
      await prisma.session.count({
        where: {
          sess: {
            path: ['userId'],
            equals: user.id,
          },
        },
      }),
    ).toBe(0);
  });

  it.each([
    {
      caseId: 'TC-AUTH-008',
      name: 'an incorrect password',
      useExistingEmail: true,
      loginPassword: 'WrongPassword2026!',
    },
    {
      caseId: 'TC-AUTH-009',
      name: 'an unknown email',
      useExistingEmail: false,
      loginPassword: 'PetopiaTest2026!',
    },
  ])(
    '[$caseId] should reject $name without authenticating',
    async ({ useExistingEmail, loginPassword }) => {
      const agent = request.agent(app.getHttpServer());

      const response = await agent
        .post('/auth/login')
        .send({
          email: useExistingEmail
            ? email
            : `missing-${randomUUID()}@example.com`,
          password: loginPassword,
        })
        .expect(401);

      const body = response.body as Record<string, unknown>;

      expect(body.message).toBe('Invalid email or password');
      expect(response.headers['set-cookie']).toBeUndefined();

      await agent.get('/auth/me').expect(401);

      const user = await prisma.user.findUniqueOrThrow({
        where: { email },
        select: { id: true },
      });

      expect(
        await prisma.session.count({
          where: {
            sess: {
              path: ['userId'],
              equals: user.id,
            },
          },
        }),
      ).toBe(0);
    },
  );
  it('[TC-AUTH-013] should reject an existing session when the account is deactivated', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent.post('/auth/login').send({ email, password }).expect(200);

    await agent.get('/auth/me').expect(200);

    try {
      await prisma.user.update({
        where: { email },
        data: { active: false },
      });

      await agent.get('/auth/me').expect(401);
    } finally {
      await prisma.user.update({
        where: { email },
        data: { active: true },
      });

      await agent.post('/auth/logout').expect(204);
    }
  });

  it('[TC-AUTH-014] should reject an old session after auth version changes and allow a new login', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent.post('/auth/login').send({ email, password }).expect(200);

    await agent.get('/auth/me').expect(200);

    try {
      await prisma.user.update({
        where: { email },
        data: {
          authVersion: { increment: 1 },
        },
      });

      await agent.get('/auth/me').expect(401);

      await agent.post('/auth/login').send({ email, password }).expect(200);

      await agent.get('/auth/me').expect(200);
    } finally {
      await agent.post('/auth/logout').expect(204);
    }
  });
});
