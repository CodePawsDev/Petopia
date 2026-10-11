import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap().catch((error: unknown) => {
  console.error('Failed to start API:', error);
  process.exitCode = 1;
});
