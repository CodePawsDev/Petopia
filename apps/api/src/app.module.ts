import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { SessionModule } from './session/session.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { BranchWorkspaceModule } from './branch-workspace/branch-workspace.module';
import { PetsModule } from './pets/pets.module';
import { CatalogModule } from './catalog/catalog.module';
import { QuotesModule } from './quotes/quotes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: (config: Record<string, unknown>) => {
        const databaseUrl = config['DATABASE_URL'];
        const sessionSecret = config['SESSION_SECRET'];

        if (
          typeof databaseUrl !== 'string' ||
          databaseUrl.trim().length === 0
        ) {
          throw new Error('DATABASE_URL is required');
        }

        if (
          typeof sessionSecret !== 'string' ||
          !/^[0-9a-fA-F]{64}$/.test(sessionSecret)
        ) {
          throw new Error(
            'SESSION_SECRET must be a 64-character hexadecimal string',
          );
        }

        return config;
      },
    }),
    PrismaModule,
    AuthModule,
    SessionModule,
    AuthorizationModule,
    BranchWorkspaceModule,
    PetsModule,
    CatalogModule,
    QuotesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
