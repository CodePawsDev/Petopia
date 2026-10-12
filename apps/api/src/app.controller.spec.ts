import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

jest.mock('./prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('AppController', () => {
  let appController: AppController;

  const prismaMock = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    prismaMock.$queryRaw.mockReset();

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('checkDatabase', () => {
    it('should return connected when the database query succeeds', async () => {
      prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      await expect(appController.checkDatabase()).resolves.toEqual({
        status: 'ok',
        database: 'connected',
      });

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('should return 503 without exposing internal database errors', async () => {
      prismaMock.$queryRaw.mockRejectedValue(
        new Error('Sensitive database error'),
      );

      const result = appController.checkDatabase();

      await expect(result).rejects.toBeInstanceOf(ServiceUnavailableException);

      await expect(result).rejects.toMatchObject({
        response: {
          statusCode: 503,
          message: 'Database unavailable',
          error: 'Service Unavailable',
        },
      });
    });
  });
});
