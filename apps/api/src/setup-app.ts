import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import session from 'express-session';
import { SessionStoreService } from './session/session-store.service';

export function setupApp(app: INestApplication): void {
  const configService = app.get(ConfigService);
  const sessionStoreService = app.get(SessionStoreService);
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  app.use(
    session({
      name: 'petopia.sid',
      secret: configService.getOrThrow<string>('SESSION_SECRET'),
      store: sessionStoreService.store,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: 8 * 60 * 60 * 1000,
      },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: {
        target: false,
        value: false,
      },
    }),
  );
}
