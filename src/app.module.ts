import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { PermisosGuard } from './modules/auth/guards/permisos.guard';
import { ContribuyentesModule } from './modules/contribuyentes/contribuyentes.module';
import { HealthModule } from './modules/health/health.module';
import { ProductosModule } from './modules/productos/productos.module';
import { PuntosEmisionModule } from './modules/puntos-emision/puntos-emision.module';
import { SeniatModule } from './modules/seniat/seniat.module';
import { TercerosModule } from './modules/terceros/terceros.module';

@Module({
  imports: [
    // Configuración global (variables de entorno validadas).
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),

    // Rate limiting básico (protección contra abuso / fuerza bruta).
    ThrottlerModule.forRoot([
      {
        ttl: 60_000, // 1 minuto
        limit: 100, // 100 peticiones por IP por minuto
      },
    ]),

    // Infraestructura.
    PrismaModule,
    AuditoriaModule,
    SeniatModule,

    // Módulos de dominio.
    AuthModule,
    ContribuyentesModule,
    TercerosModule,
    ProductosModule,
    PuntosEmisionModule,
    HealthModule,
    // A medida que avancen las épicas se agregan aquí:
    // ClientesModule, ProveedoresModule, ProductosModule,
    // FacturacionModule, ImprentaModule, ContabilidadModule, ...
  ],
  providers: [
    // Orden importante: 1) rate limit, 2) autenticación (JWT), 3) autorización (RBAC).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermisosGuard },
  ],
})
export class AppModule {}
