import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './setup-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  setupApp(app);
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3001);
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start API:', error);
  process.exitCode = 1;
});
