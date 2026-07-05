# Dockerización del microservicio Tasas BCV

## Enfoque recomendado

El despliegue recomendado del proyecto es **Docker Compose**. Compose mantiene vivos los procesos con `restart: unless-stopped`, centraliza logs y evita depender de servicios externos del host para la API o el scraping.

Este proyecto usa **una misma imagen** para dos servicios:

| Servicio | Rol | Comando |
|----------|-----|---------|
| `api` | Expone las rutas HTTP NestJS | `npm run db:setup:prod && node dist/main.js` |
| `bcv-scheduler` | Ejecuta scraping BCV 3 veces al día | `node dist/scheduler.js` |

Así la API queda siempre arriba y el scraping se ejecuta dentro del entorno Docker.

## Archivos agregados

| Archivo | Propósito |
|---------|-----------|
| `Dockerfile` | Construye la imagen productiva NestJS. |
| `.dockerignore` | Evita copiar `node_modules`, `.env`, `dist`, logs, etc. |
| `docker-compose.yml` | Levanta la API y el scheduler BCV. |
| `src/scheduler.ts` | Scheduler Node/Nest para ejecutar `BcvSyncService` en horarios definidos. |

## Variables de entorno

Docker Compose usa el archivo `.env` del proyecto mediante `env_file`.

Variables importantes:

```env
DATABASE_URL=postgresql://USUARIO:CONTRASEÑA@HOST:5432/BNPL
API_PORT=3000
API_HOST=0.0.0.0
BCV_PAGE_URL=https://www.bcv.org.ve/
BCV_INSECURE_TLS=1
```

Para el scheduler:

```env
BCV_SYNC_HOURS=8,14,20
BCV_SYNC_RUN_ON_START=0
TZ=America/Caracas
```

`BCV_SYNC_HOURS` son las horas del día (0-23) en la zona horaria del contenedor. En `docker-compose.yml` se fija `TZ=America/Caracas`.

## Consideraciones sobre la base de datos

Si PostgreSQL está fuera de Docker:

- `DATABASE_URL` debe apuntar a una IP/host alcanzable desde el contenedor.
- No uses `localhost` para una base externa al contenedor; dentro del contenedor, `localhost` es el propio contenedor.
- En Linux puedes usar una IP real de red (como `172.16.x.x`) o `host.docker.internal` si lo tienes configurado.

Si PostgreSQL estará también en Compose en el futuro:

- Agrega un servicio `postgres`.
- Cambia `DATABASE_URL` a algo como `postgresql://postgres:password@postgres:5432/BNPL`.
- Usa volúmenes para persistir datos (`postgres_data:/var/lib/postgresql/data`).

## Construir imagen

```bash
docker compose build
```

O con Docker directo:

```bash
docker build -t tasas-bcv:latest .
```

## Levantar servicios

```bash
docker compose up -d
```

Esto hace:

1. Construye/usa la imagen `tasas-bcv:latest`.
2. Levanta `api`.
3. Ejecuta migraciones TypeORM con `db:setup:prod`.
4. Inicia NestJS en `dist/main.js`.
5. Cuando la API está saludable, levanta `bcv-scheduler`.
6. El scheduler ejecuta el scraping a las 08:00, 14:00 y 20:00.

## Ver estado y logs

```bash
docker compose ps
docker compose logs -f api
docker compose logs -f bcv-scheduler
```

## Probar API

```bash
curl -s http://127.0.0.1:3000/health
curl -s http://127.0.0.1:3000/api/tasas/ultimas
curl -s http://127.0.0.1:3000/api/tasas/fecha/2026-05-15
```

## Ejecutar scraping manual

```bash
docker compose run --rm bcv-scheduler node dist/cli.js bcv:sync
```

## Importar CSV desde Docker

Si el CSV está incluido en el contexto del proyecto:

```bash
docker compose run --rm api npm run db:import:prod
```

Si prefieres montar un CSV externo:

```bash
docker compose run --rm \
  -e CSV_PATH=/data/tasas.csv \
  -v "/ruta/local/Listado de Tasas Diarias.csv:/data/tasas.csv:ro" \
  api npm run db:import:prod
```

## Actualizar una versión desplegada

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

## Detener servicios

```bash
docker compose down
```
