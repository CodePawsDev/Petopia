import { config } from 'dotenv';
import { resolve } from 'node:path';

config({
  path: resolve(__dirname, '../.env.test'),
  override: false,
});

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for e2e tests');
}

if (new URL(databaseUrl).pathname !== '/petopia_test') {
  throw new Error('E2E tests must use the petopia_test database');
}
