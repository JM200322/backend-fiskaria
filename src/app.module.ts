import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { PermisosGuard } from './modules/auth/guards/permisos.guard';
import { ComprasModule } from './modules/compras/compras.module';
import { ContabilidadModule } from './modules/contabilidad/contabilidad.module';
import { ContribuyentesModule } from './modules/contribuyentes/contribuyentes.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { MunicipalesModule } from './modules/municipales/municipales.module';
import { FacturadorModule } from './modules/facturador/facturador.module';
import { HealthModule } from './modules/health/health.module';
import { ImprentaModule } from './modules/imprenta/imprenta.module';
import { ProductosModule } from './modules/productos/productos.module';
import { PuntosEmisionModule } from './modules/puntos-emision/puntos-emision.module';
import { SeniatModule } from './modules/seniat/seniat.module';
import { TercerosModule } from './modules/terceros/terceros.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { VentasModule } from './modules/ventas/ventas.module';

@Module({
  imports: [
    // Configuración global (variables de entorno validadas).
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),

    // Rate limiting (configurable por entorno; protección contra abuso / fuerza bruta).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('throttle.ttlMs') ?? 60_000,
          limit: config.get<number>('throttle.limit') ?? 100,
        },
      ],
    }),

    // Infraestructura.
    PrismaModule,
    AuditoriaModule,
    SeniatModule,
    ImprentaModule,

    // Módulos de dominio.
    AuthModule,
    UsuariosModule,
    ContribuyentesModule,
    TercerosModule,
    ProductosModule,
    PuntosEmisionModule,
    FacturadorModule,
    VentasModule,
    ComprasModule,
    ContabilidadModule,
    DashboardModule,
    MunicipalesModule,
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
