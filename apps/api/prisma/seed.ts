import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

async function main(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const databaseName = new URL(databaseUrl).pathname;

  if (!['/petopia_dev', '/petopia_test'].includes(databaseName)) {
    throw new Error('Seed must use petopia_dev or petopia_test');
  }

  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  });

  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$transaction(async (tx) => {
      const grooming = await tx.businessUnit.upsert({
        where: { code: 'GROOMING' },
        update: {},
        create: {
          code: 'GROOMING',
          name: 'Petopia Grooming',
        },
      });

      const branches = [
        {
          code: 'GROOMING-ARI',
          name: 'Petopia Grooming สาขาอารีย์',
        },
        {
          code: 'GROOMING-ONNUT',
          name: 'Petopia Grooming สาขาอ่อนนุช',
        },
      ];

      for (const branch of branches) {
        await tx.branch.upsert({
          where: { code: branch.code },
          update: {},
          create: {
            ...branch,
            businessUnitId: grooming.id,
            timezone: 'Asia/Bangkok',
          },
        });
      }
    });

    console.log('Seed completed: Petopia Grooming and two demo branches.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});
