import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';

const PgSessionStore = connectPgSimple(session);

@Injectable()
export class SessionStoreService implements OnApplicationShutdown {
  readonly store: InstanceType<typeof PgSessionStore>;

  constructor(configService: ConfigService) {
    this.store = new PgSessionStore({
      conObject: {
        connectionString: configService.getOrThrow<string>('DATABASE_URL'),
        connectionTimeoutMillis: 5000,
      },
      schemaName: 'public',
      tableName: 'session',
      createTableIfMissing: false,
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.resolve(this.store.close());
  }
}
