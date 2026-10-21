import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { StaffRole } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';

describe('Service catalog (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const branchId = randomUUID();
  const otherBranchId = randomUUID();
  const groomerId = randomUUID();
  const assignmentId = randomUUID();
  const suffix = randomUUID();

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);

    await app.init();
    prisma = app.get(PrismaService);

    const businessUnit = await prisma.businessUnit.findUniqueOrThrow({
      where: { code: 'GROOMING' },
      select: { id: true },
    });

    await prisma.branch.createMany({
      data: [
        {
          id: branchId,
          businessUnitId: businessUnit.id,
          code: `CAT-A-${suffix}`,
          name: 'Catalog Test Branch A',
        },
        {
          id: otherBranchId,
          businessUnitId: businessUnit.id,
          code: `CAT-B-${suffix}`,
          name: 'Catalog Test Branch B',
        },
      ],
    });

    await prisma.user.create({
      data: {
        id: groomerId,
        email: `catalog-${suffix}@example.com`,
        displayName: 'Catalog Test Groomer',
        passwordHash: 'unused-test-fixture',
      },
    });

    await prisma.staffAssignment.create({
      data: {
        id: assignmentId,
        userId: groomerId,
        branchId,
        role: StaffRole.GROOMER,
      },
    });
  });

  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.staffAssignment.deleteMany({
          where: { userId: groomerId },
        });

        await prisma.branch.deleteMany({
          where: { id: { in: [branchId, otherBranchId] } },
        });

        await prisma.user.deleteMany({
          where: { id: groomerId },
        });
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('[TC-CATALOG-001] lists active grooming branches without authentication', async () => {
    const response = await request(app.getHttpServer())
      .get('/catalog/branches')
      .expect(200)
      .expect('Cache-Control', 'no-store');

    const branches = response.body as Array<Record<string, unknown>>;

    expect(Array.isArray(branches)).toBe(true);
    expect(branches).toEqual(
      expect.arrayContaining([
        {
          id: branchId,
          code: `CAT-A-${suffix}`,
          name: 'Catalog Test Branch A',
          timezone: 'Asia/Bangkok',
        },
      ]),
    );
  });

  it('[TC-CATALOG-002] returns public service rates as numbers', async () => {
    const response = await request(app.getHttpServer())
      .get(`/catalog/branches/${branchId}/services`)
      .expect(200)
      .expect('Cache-Control', 'no-store');

    const body = response.body as {
      currency: string;
      services: Array<{
        rates: Array<{
          minWeightKg: number;
          maxWeightKg: number;
          priceSatang: number;
          durationMinutes: number;
        }>;
      }>;
    };

    expect(body.currency).toBe('THB');
    expect(body.services.length).toBeGreaterThan(0);

    for (const service of body.services) {
      expect(service.rates.length).toBeGreaterThan(0);

      for (const rate of service.rates) {
        expect(typeof rate.minWeightKg).toBe('number');
        expect(typeof rate.maxWeightKg).toBe('number');
        expect(rate.maxWeightKg).toBeGreaterThan(rate.minWeightKg);
        expect(Number.isInteger(rate.priceSatang)).toBe(true);
        expect(rate.priceSatang).toBeGreaterThan(0);
        expect(Number.isInteger(rate.durationMinutes)).toBe(true);
        expect(rate.durationMinutes).toBeGreaterThan(0);
      }
    }
  });

  it('[TC-CATALOG-003] lists only public groomer fields for the assigned branch', async () => {
    await request(app.getHttpServer())
      .get(`/catalog/branches/${branchId}/groomers`)
      .expect(200)
      .expect('Cache-Control', 'no-store')
      .expect({
        branch: {
          id: branchId,
          code: `CAT-A-${suffix}`,
          name: 'Catalog Test Branch A',
        },
        groomers: [
          {
            id: groomerId,
            displayName: 'Catalog Test Groomer',
          },
        ],
      });

    await request(app.getHttpServer())
      .get(`/catalog/branches/${otherBranchId}/groomers`)
      .expect(200)
      .expect({
        branch: {
          id: otherBranchId,
          code: `CAT-B-${suffix}`,
          name: 'Catalog Test Branch B',
        },
        groomers: [],
      });
  });

  it('[TC-CATALOG-004] hides an inactive groomer assignment', async () => {
    try {
      await prisma.staffAssignment.update({
        where: { id: assignmentId },
        data: { active: false },
      });

      const response = await request(app.getHttpServer())
        .get(`/catalog/branches/${branchId}/groomers`)
        .expect(200);

      const body = response.body as Record<string, unknown>;
      expect(body.groomers).toEqual([]);
    } finally {
      await prisma.staffAssignment.update({
        where: { id: assignmentId },
        data: { active: true },
      });
    }
  });

  it('[TC-CATALOG-005] hides an inactive groomer account', async () => {
    try {
      await prisma.user.update({
        where: { id: groomerId },
        data: { active: false },
      });

      const response = await request(app.getHttpServer())
        .get(`/catalog/branches/${branchId}/groomers`)
        .expect(200);

      const body = response.body as Record<string, unknown>;
      expect(body.groomers).toEqual([]);
    } finally {
      await prisma.user.update({
        where: { id: groomerId },
        data: { active: true },
      });
    }
  });

  it('[TC-CATALOG-006] hides an inactive branch and rejects its detail endpoints', async () => {
    try {
      await prisma.branch.update({
        where: { id: branchId },
        data: { active: false },
      });

      const response = await request(app.getHttpServer())
        .get('/catalog/branches')
        .expect(200);

      const branches = response.body as Array<Record<string, unknown>>;
      expect(branches.some((branch) => branch.id === branchId)).toBe(false);

      for (const endpoint of ['services', 'groomers']) {
        await request(app.getHttpServer())
          .get(`/catalog/branches/${branchId}/${endpoint}`)
          .expect(404);
      }
    } finally {
      await prisma.branch.update({
        where: { id: branchId },
        data: { active: true },
      });
    }
  });

  it.each(['services', 'groomers'])(
    '[TC-CATALOG-007] rejects malformed branch IDs for %s',
    async (endpoint) => {
      await request(app.getHttpServer())
        .get(`/catalog/branches/invalid-id/${endpoint}`)
        .expect(400);
    },
  );

  it.each(['services', 'groomers'])(
    '[TC-CATALOG-008] returns 404 for an unknown branch on %s',
    async (endpoint) => {
      await request(app.getHttpServer())
        .get(`/catalog/branches/${randomUUID()}/${endpoint}`)
        .expect(404);
    },
  );
  it('[TC-CATALOG-009] hides an inactive service', async () => {
    const service = await prisma.groomingService.findFirstOrThrow({
      where: {
        active: true,
        businessUnit: { code: 'GROOMING' },
        rates: { some: { active: true } },
      },
      select: { id: true },
    });

    try {
      await prisma.groomingService.update({
        where: { id: service.id },
        data: { active: false },
      });

      const response = await request(app.getHttpServer())
        .get(`/catalog/branches/${branchId}/services`)
        .expect(200);

      const body = response.body as {
        services: Array<{ id: string }>;
      };

      expect(body.services.some((item) => item.id === service.id)).toBe(false);
    } finally {
      await prisma.groomingService.update({
        where: { id: service.id },
        data: { active: true },
      });
    }
  });

  it('[TC-CATALOG-010] hides an inactive rate and a service with no active rates', async () => {
    const service = await prisma.groomingService.findFirstOrThrow({
      where: {
        active: true,
        businessUnit: { code: 'GROOMING' },
      },
      select: {
        id: true,
        rates: {
          where: { active: true },
          select: { id: true },
          orderBy: { id: 'asc' },
        },
      },
    });

    const activeRateIds = service.rates.map((rate) => rate.id);
    expect(activeRateIds.length).toBeGreaterThan(1);

    const rateId = activeRateIds[0];

    try {
      await prisma.groomingServiceRate.update({
        where: { id: rateId },
        data: { active: false },
      });

      const response = await request(app.getHttpServer())
        .get(`/catalog/branches/${branchId}/services`)
        .expect(200);

      const body = response.body as {
        services: Array<{
          id: string;
          rates: Array<{ id: string }>;
        }>;
      };

      const visibleService = body.services.find(
        (item) => item.id === service.id,
      );

      expect(visibleService).toBeDefined();
      expect(visibleService?.rates.map((rate) => rate.id).sort()).toEqual(
        activeRateIds.filter((id) => id !== rateId).sort(),
      );

      await prisma.groomingServiceRate.updateMany({
        where: { id: { in: activeRateIds } },
        data: { active: false },
      });

      const emptyRatesResponse = await request(app.getHttpServer())
        .get(`/catalog/branches/${branchId}/services`)
        .expect(200);

      const emptyRatesBody = emptyRatesResponse.body as {
        services: Array<{ id: string }>;
      };

      expect(
        emptyRatesBody.services.some((item) => item.id === service.id),
      ).toBe(false);
    } finally {
      await prisma.groomingServiceRate.updateMany({
        where: { id: { in: activeRateIds } },
        data: { active: true },
      });
    }
  });
  it('[TC-CATALOG-011] should hide branches and reject catalog requests for an inactive business unit', async () => {
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
        .get('/catalog/branches')
        .expect(200);

      const branches = response.body as Array<{ id: string }>;

      expect(branches.some((item) => item.id === branchId)).toBe(false);
      expect(branches.some((item) => item.id === otherBranchId)).toBe(false);

      await request(app.getHttpServer())
        .get(`/catalog/branches/${branchId}/services`)
        .expect(404);

      await request(app.getHttpServer())
        .get(`/catalog/branches/${branchId}/groomers`)
        .expect(404);
    } finally {
      await prisma.businessUnit.update({
        where: { id: businessUnit.id },
        data: { active: businessUnit.active },
      });
    }
  });
  it('[TC-CATALOG-012] should expose continuous weight bands within species limits and require rabbit assessment', async () => {
    const response = await request(app.getHttpServer())
      .get(`/catalog/branches/${branchId}/services`)
      .expect(200);

    type Rate = {
      species: string;
      minWeightKg: number;
      maxWeightKg: number;
      requiresAssessment: boolean;
    };

    const body = response.body as {
      services: Array<{
        code: string;
        rates: Rate[];
      }>;
    };

    const weightLimits: Record<string, number> = {
      DOG: 80,
      CAT: 15,
      RABBIT: 8,
    };

    expect(body.services.length).toBeGreaterThan(0);

    const seenSpecies = new Set<string>();

    for (const service of body.services) {
      const groups = new Map<string, Rate[]>();

      for (const rate of service.rates) {
        expect(Object.hasOwn(weightLimits, rate.species)).toBe(true);
        seenSpecies.add(rate.species);

        const rates = groups.get(rate.species) ?? [];
        rates.push(rate);
        groups.set(rate.species, rates);

        if (rate.species === 'RABBIT') {
          expect(rate.requiresAssessment).toBe(true);
        }
      }

      expect(groups.size).toBeGreaterThan(0);

      for (const [species, rates] of groups) {
        rates.sort((a, b) => a.minWeightKg - b.minWeightKg);

        let previousMax = 0;

        for (const rate of rates) {
          expect(rate.minWeightKg).toBe(previousMax);
          expect(rate.maxWeightKg).toBeGreaterThan(rate.minWeightKg);
          expect(rate.maxWeightKg).toBeLessThanOrEqual(weightLimits[species]);

          previousMax = rate.maxWeightKg;
        }

        expect(previousMax).toBe(weightLimits[species]);
      }
    }

    expect([...seenSpecies].sort()).toEqual(['CAT', 'DOG', 'RABBIT']);
  });
});
