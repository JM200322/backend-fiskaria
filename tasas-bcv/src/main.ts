import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix('');

  const port = Number(process.env.API_PORT || 3000);
  const host = process.env.API_HOST || '127.0.0.1';

  await app.listen(port, host);
  console.log(`API tasas escuchando en http://${host}:${port}`);
}

void bootstrap();
