import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  StaffPermission,
  StaffRole,
} from '../src/generated/prisma/client';

async function main(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  const demoPassword = process.env['DEMO_PASSWORD'];

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  if (new URL(databaseUrl).pathname !== '/petopia_dev') {
    throw new Error('Demo accounts must use petopia_dev');
  }

  if (!demoPassword || demoPassword.length < 8 || demoPassword.length > 128) {
    throw new Error('DEMO_PASSWORD must contain 8–128 characters');
  }

  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  });

  const prisma = new PrismaClient({ adapter });

  try {
    const ari = await prisma.branch.findUniqueOrThrow({
      where: { code: 'GROOMING-ARI' },
      select: { id: true },
    });

    const onnut = await prisma.branch.findUniqueOrThrow({
      where: { code: 'GROOMING-ONNUT' },
      select: { id: true },
    });

    const passwordHash = await argon2.hash(demoPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    await prisma.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { email: 'customer@demo.petopia.test' },
        update: {},
        create: {
          email: 'customer@demo.petopia.test',
          displayName: 'Demo Customer',
          passwordHash,
        },
      });

      const manager = await tx.user.upsert({
        where: { email: 'manager.ari@demo.petopia.test' },
        update: {},
        create: {
          email: 'manager.ari@demo.petopia.test',
          displayName: 'Demo Ari Manager',
          passwordHash,
        },
      });

      const groomer = await tx.user.upsert({
        where: { email: 'groomer.ari@demo.petopia.test' },
        update: {},
        create: {
          email: 'groomer.ari@demo.petopia.test',
          displayName: 'Demo Ari Groomer',
          passwordHash,
        },
      });

      const onnutGroomer = await tx.user.upsert({
        where: { email: 'groomer.onnut@demo.petopia.test' },
        update: {},
        create: {
          email: 'groomer.onnut@demo.petopia.test',
          displayName: 'Demo Onnut Groomer',
          passwordHash,
        },
      });

      const cashier = await tx.user.upsert({
        where: { email: 'cashier.onnut@demo.petopia.test' },
        update: {},
        create: {
          email: 'cashier.onnut@demo.petopia.test',
          displayName: 'Demo Onnut Cashier',
          passwordHash,
        },
      });

      await tx.staffAssignment.upsert({
        where: {
          userId_branchId_role: {
            userId: manager.id,
            branchId: ari.id,
            role: StaffRole.BRANCH_MANAGER,
          },
        },
        update: {},
        create: {
          userId: manager.id,
          branchId: ari.id,
          role: StaffRole.BRANCH_MANAGER,
        },
      });

      await tx.staffAssignment.upsert({
        where: {
          userId_branchId_role: {
            userId: groomer.id,
            branchId: ari.id,
            role: StaffRole.GROOMER,
          },
        },
        update: {},
        create: {
          userId: groomer.id,
          branchId: ari.id,
          role: StaffRole.GROOMER,
        },
      });

      await tx.staffAssignment.upsert({
        where: {
          userId_branchId_role: {
            userId: onnutGroomer.id,
            branchId: onnut.id,
            role: StaffRole.GROOMER,
          },
        },
        update: {},
        create: {
          userId: onnutGroomer.id,
          branchId: onnut.id,
          role: StaffRole.GROOMER,
        },
      });

      await tx.permissionGrant.upsert({
        where: {
          userId_branchId_permission: {
            userId: cashier.id,
            branchId: onnut.id,
            permission: StaffPermission.RECEIVE_PAYMENT,
          },
        },
        update: {},
        create: {
          userId: cashier.id,
          branchId: onnut.id,
          permission: StaffPermission.RECEIVE_PAYMENT,
        },
      });
    });

    console.log('Demo seed completed: five accounts and branch permissions.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Demo seed failed:', error);
  process.exitCode = 1;
});
