# Facturador Backend — Sirumatek

API del **Sistema de Facturación Web con Cumplimiento Fiscal Venezolano**. Construida con **NestJS + Prisma + PostgreSQL**.

> Repositorio independiente del frontend (Next.js). La documentación funcional y de arquitectura vive en el proyecto de documentación (`Documentacion_Proyecto_facturador/docs`).

## Requisitos

- Node.js >= 20
- Docker (para PostgreSQL, Redis y MinIO en local)

## Puesta en marcha

```bash
# 1. Instalar dependencias
npm install

# 2. Crear tu archivo de entorno
cp .env.example .env   # (en Windows PowerShell: copy .env.example .env)

# 3. Levantar servicios de apoyo (PostgreSQL + Redis + MinIO)
npm run db:up

# 4. Generar el cliente de Prisma y aplicar migraciones
npm run prisma:generate
npm run prisma:migrate

# 5. Arrancar la API en modo desarrollo
npm run start:dev
```

La API queda en `http://localhost:3000/api` y Swagger en `http://localhost:3000/api/docs`.

Verifica que todo funciona:

```bash
curl http://localhost:3000/api/health
```

## Servicios locales (docker-compose)

| Servicio | Puerto | Notas |
|---|---|---|
| PostgreSQL | 5432 | usuario/clave/db: `facturador` |
| Redis | 6379 | colas y cache |
| MinIO (S3) | 9000 / 9001 | consola web en :9001 (minioadmin/minioadmin) |

## Estructura

```
src/
├── main.ts                 # Bootstrap (CORS, helmet, validación, Swagger)
├── app.module.ts           # Módulo raíz
├── config/                 # Configuración y validación de entorno
├── common/                 # Filtros e interceptores transversales
├── prisma/                 # PrismaModule + PrismaService (global)
└── modules/                # Módulos de dominio (uno por épica)
    └── health/             # Endpoint de salud
prisma/
└── schema.prisma           # Esquema de BD (ERD se define en Épica 0C)
```

## Convenciones

- Un **módulo por dominio/épica** (auth, clientes, productos, facturación, imprenta, contabilidad…).
- Dinero siempre como `Decimal` (nunca `float`).
- Auditoría (`createdAt`/`updatedAt`) y soft delete (`deletedAt`) según corresponda.
- Las rarezas de la Imprenta Digital se aíslan en el módulo `imprenta` (ver doc 08 de la documentación).

## Scripts útiles

| Script | Acción |
|---|---|
| `npm run start:dev` | API con recarga en caliente |
| `npm run prisma:studio` | Explorador visual de la BD |
| `npm run lint` | Lint + autofix |
| `npm test` | Pruebas unitarias |
| `npm run db:up` / `db:down` | Levantar / detener servicios Docker |

## Estado

Andamiaje inicial (Épica 1 en curso). Próximos pasos: autenticación + RBAC, `fiscal-utils`, maestros (clientes/proveedores/productos), servicio de tasa BCV y adaptador de imprenta.
