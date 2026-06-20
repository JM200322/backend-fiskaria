import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const apiPrefix = config.get<string>('apiPrefix') ?? 'api';
  const port = config.get<number>('port') ?? 3000;
  const corsOrigins = config.get<string[]>('corsOrigins') ?? [];

  // Seguridad y CORS.
  app.use(helmet());
  app.enableCors({ origin: corsOrigins, credentials: true });

  // Prefijo global de rutas (ej. /api/...).
  app.setGlobalPrefix(apiPrefix);

  // Validación automática de DTOs en toda la app.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Manejo de errores y logging uniformes.
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Documentación OpenAPI (Swagger) en /{apiPrefix}/docs.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Facturador API — Sirumatek')
    .setDescription('API del Sistema de Facturación Web con Cumplimiento Fiscal Venezolano')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  await app.listen(port);
  logger.log(`API escuchando en http://localhost:${port}/${apiPrefix}`);
  logger.log(`Swagger disponible en http://localhost:${port}/${apiPrefix}/docs`);
}

void bootstrap();
