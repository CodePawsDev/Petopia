import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  it('/ (GET) should return Hello World', async () => {
    await request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/health/database (GET) should return connected', async () => {
    await request(app.getHttpServer())
      .get('/health/database')
      .expect(200)
      .expect({
        status: 'ok',
        database: 'connected',
      });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });
});
