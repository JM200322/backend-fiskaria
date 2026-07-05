# Tasas BCV — Microservicio de tasas diarias (EUR / USD)

Proyecto **NestJS + TypeScript** pensado como **microservicio** que centraliza las **tasas de cambio diarias** (principalmente **EUR** y **USD**) frente al bolívar: las **persiste en PostgreSQL** mediante **TypeORM** y las **expone por una API HTTP** de solo lectura. Complementa la carga histórica desde **CSV** con una **sincronización opcional** desde la portada del **BCV**.

---

## Tabla de contenidos

1. [Visión general](#1-visión-general)
2. [Arquitectura del microservicio](#2-arquitectura-del-microservicio)
3. [Estructura del repositorio](#3-estructura-del-repositorio)
4. [Requisitos](#4-requisitos)
5. [Configuración (`.env`)](#5-configuración-env)
6. [Modelo de datos y DTOs](#6-modelo-de-datos-y-dtos)
7. [Migración / carga desde CSV](#7-migración--carga-desde-csv)
8. [Sincronización con el sitio del BCV](#8-sincronización-con-el-sitio-del-bcv)
9. [API HTTP de consulta](#9-api-http-de-consulta)
10. [Puesta en marcha end-to-end](#10-puesta-en-marcha-end-to-end)
11. [Operación continua con Docker](#11-operación-continua-con-docker)
12. [Documentación adicional](#12-documentación-adicional)
13. [Problemas frecuentes](#13-problemas-frecuentes)

---

## 1. Visión general

| Capacidad | Descripción |
|-----------|-------------|
| **Framework** | NestJS con TypeScript. |
| **Almacenamiento** | PostgreSQL, esquema **`DBO`**, tabla **`tasas_diarias`**, migración TypeORM. |
| **Ingesta CSV** | Comando CLI NestJS, importación masiva e idempotente (upsert por moneda + fecha). |
| **Ingesta web** | Comando CLI NestJS que lee EUR/USD de `bcv.org.ve` y escribe en la misma tabla si el día aún no está completo. |
| **Consulta** | API NestJS **GET** para la última fecha con datos y para una fecha concreta. |

No incluye autenticación en la API: en despliegue real conviene **API Gateway**, **VPN** o **reverse proxy** con reglas de acceso...

---

## 2. Arquitectura del microservicio

```mermaid
flowchart LR
  subgraph ingest
    CSV[Listado CSV]
    WEB[Sitio BCV]
    S1[TypeORM migration]
    S2[Docker scheduler bcv]
  end
  PG[(PostgreSQL DBO.tasas_diarias)]
  API[NestJS API src/main.ts]
  CSV --> S1
  S1 --> PG
  CSV --> S1
  WEB --> S2
  S2 --> PG
  PG --> API
  Cliente[Clientes HTTP] --> API
```

- **Fuente CSV:** migración inicial o reconciliación con archivos exportados.
- **Fuente BCV:** actualización automática del día vía servicio Docker `bcv-scheduler`.
- **API:** solo lectura sobre PostgreSQL; se expone con el servicio Docker `api`.

---

## 3. Estructura del repositorio

| Ruta | Rol |
|------|-----|
| `src/main.ts` | Bootstrap de la API NestJS. |
| `src/app.module.ts` | Módulo raíz: ConfigModule, TypeORM, módulos de tasas/import/BCV. |
| `src/tasas/` | Controller, service y entidad TypeORM `TasaDiaria`. |
| `src/import/` | Servicio NestJS de importación CSV. |
| `src/bcv/` | Servicio NestJS de sincronización BCV. |
| `src/cli.ts` | Punto de entrada CLI para `import:csv` y `bcv:sync`. |
| `src/scheduler.ts` | Proceso vivo del scheduler BCV usado por Docker. |
| `src/database/migrations/` | Migraciones TypeORM para crear `DBO.tasas_diarias`. |
| `Dockerfile` | Construye la imagen productiva del microservicio. |
| `docker-compose.yml` | Levanta `api` y `bcv-scheduler`. |
| `docs/postgresql.md` | Base de datos, creación de `BNPL`, import CSV. |
| `docs/bcv-scraper.md` | Variables BCV y comportamiento del scheduler. |
| `docs/api-http.md` | Detalle de rutas, códigos HTTP y ejemplos. |
| `docs/docker.md` | Guía principal de despliegue Docker. |
| `.env.example` | Plantilla de variables (copiar a `.env`). |

---

## 4. Requisitos

- **Node.js** 18 o superior (recomendado LTS).
- **npm** para instalar dependencias y ejecutar scripts NestJS/TypeORM.
- **Docker** y **Docker Compose** para el despliegue recomendado.
- **PostgreSQL** accesible desde la máquina o contenedor donde corran los scripts y la API.
- Base de datos creada en el servidor (p. ej. **`BNPL`**) y usuario con permisos sobre el esquema **`DBO`**.

---

## 5. Configuración (`.env`)

En la raíz del proyecto:

```bash
cp .env.example .env
```

Ajusta los valores. Referencia (sin datos reales):

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `DATABASE_URL` | Sí | `postgresql://USUARIO:CONTRASEÑA@HOST:5432/NOMBRE_BD` |
| `CSV_PATH` | No | Ruta absoluta al CSV si no está el archivo por defecto en la raíz del proyecto. |
| `BCV_PAGE_URL` | No | URL a descargar (por defecto `https://www.bcv.org.ve/`). |
| `BCV_INSECURE_TLS` | No | Si vale `1`, desactiva verificación estricta del certificado TLS al llamar al BCV (solo si lo aceptas en tu red). |
| `API_PORT` | No | Puerto de la API (por defecto `3000`). |
| `API_HOST` | No | Interfaz de escucha (por defecto `127.0.0.1`; en servidor suele usarse `0.0.0.0` detrás de un proxy). |

El archivo **`.env`** no debe versionarse (está contemplado en `.gitignore`).

---

## 6. Modelo de datos y DTOs

### 6.1 Tabla PostgreSQL `"DBO"."tasas_diarias"`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | `bigserial` | Identificador incremental (en carga CSV masiva ordenada por fecha, los **ids más altos** corresponden a las **fechas más recientes**). |
| `cur_cod` | `varchar(3)` | Código de moneda, p. ej. `EUR`, `USD`. |
| `valid_from` | `date` | Día de vigencia de la tasa. |
| `rat_exc` | `numeric(18,6)` | Tasa de cambio. |
| `created_at` | `timestamptz` | Momento de inserción/actualización de la fila. |

Restricción única: **`(cur_cod, valid_from)`** — una fila por moneda y por día.

### 6.2 DTO — fila esperada en el **CSV** (origen migración)

El importador usa la **primera fila como cabecera** y nombres de columnas exactos (o equivalentes en minúsculas tras normalización interna).

Cabecera esperada:

```text
Cur Cod,Valid From,Rat Exc
```

Equivalente lógico (DTO de una línea de datos):

```ts
// DTO conceptual por fila del CSV (no es un archivo TypeScript del repo)
interface CsvTasaDiariaRow {
  "Cur Cod": string;      // p. ej. "EUR" | "USD"
  "Valid From": string;  // texto en español, p. ej. 'mayo 14, 2026, 12:00 a. m.' (a veces con espacio estrecho entre "a." y "m.")
  "Rat Exc": string;      // número con coma o punto decimal, p. ej. "598,12" o "510.79"
}
```

Ejemplo de líneas:

```csv
Cur Cod,Valid From,Rat Exc
EUR,"mayo 14, 2026, 12:00 a. m.",598.12
USD,"mayo 14, 2026, 12:00 a. m.",510.79
```

El script convierte `Valid From` a **`YYYY-MM-DD`** y `Rat Exc` a número para `numeric(18,6)`.

### 6.3 DTO — registro expuesto por la **API** (una tasa)

```ts
interface TasaDiariaDto {
  id: string;          // bigint de PostgreSQL serializado como string
  cur_cod: "EUR" | "USD" | string;
  valid_from: string;   // YYYY-MM-DD
  rat_exc: string;      // string para preservar decimales
  created_at: string;   // ISO 8601
}
```

### 6.4 DTO — respuesta **últimas tasas** o **por fecha**

```ts
interface TasasDiaResponseDto {
  fecha: string;                    // YYYY-MM-DD
  EUR: TasaDiariaDto | null;
  USD: TasaDiariaDto | null;
}
```

Errores JSON habituales: `error` (`sin_datos`, `no_encontrado`, `fecha_invalida`, `interno`, `ruta_desconocida`) y `mensaje` opcional.

---

## 7. Migración / carga desde CSV

### 7.1 Crear esquema y tabla (una vez por entorno)

```bash
npm install
npm run db:setup
```

Ejecuta la migración TypeORM `CreateTasasDiarias...`. Crea **`DBO`** con `IF NOT EXISTS` y **`tasas_diarias`** igual. Es idempotente: no borra datos existentes.

### 7.2 Importar el CSV

Coloca el archivo **`Listado de Tasas Diarias.csv`** en la raíz del proyecto o define **`CSV_PATH`** en `.env`.

```bash
npm run db:import
```

Comportamiento:

- Ordena las filas por **`valid_from`** ascendente y **`cur_cod`** antes de insertar, para que los **`id`** crezcan con el tiempo de negocio.
- **`INSERT … ON CONFLICT (cur_cod, valid_from) DO UPDATE`**: re-ejecutar el import actualiza `rat_exc` si cambia el valor en el archivo.

Detalle ampliado: [docs/postgresql.md](./docs/postgresql.md).

---

## 8. Sincronización con el sitio del BCV

En producción Docker, la sincronización queda a cargo del servicio **`bcv-scheduler`**:

```bash
docker compose up -d bcv-scheduler
```

Por defecto ejecuta el scraping a las **08:00**, **14:00** y **20:00** en `America/Caracas` (`BCV_SYNC_HOURS=8,14,20`).

Para una ejecución manual:

```bash
npm run bcv:sync
```

- Solo **EUR** y **USD** desde la portada del BCV.
- Si **ya existen** filas EUR y USD para la **fecha de valor** leída en el HTML, **no escribe** en base (sí descarga la página para leer la fecha y las tasas).

TLS: si aparece `unable to verify the first certificate`, revisa [docs/bcv-scraper.md](./docs/bcv-scraper.md) y la variable **`BCV_INSECURE_TLS`**.

Detalle del scheduler: [docs/bcv-scraper.md](./docs/bcv-scraper.md).

---

## 9. API HTTP de consulta

Arranque:

```bash
npm run api:start
```

En producción Docker:

```bash
docker compose up -d api
```

Rutas principales:

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Comprueba que el servicio vive. |
| `GET` | `/api/tasas/ultimas` | Máximo `valid_from` en tabla y objetos **EUR** / **USD** para ese día. |
| `GET` | `/api/tasas/fecha/:fecha` | Tasas para **`fecha`** en formato **`YYYY-MM-DD`**. |

Ejemplos:

```bash
curl -s "http://127.0.0.1:3000/health"
curl -s "http://127.0.0.1:3000/api/tasas/ultimas"
curl -s "http://127.0.0.1:3000/api/tasas/fecha/2026-05-14"
```

Detalle de códigos HTTP y cuerpos: [docs/api-http.md](./docs/api-http.md).

---

## 10. Puesta en marcha end-to-end

Orden recomendado en un **entorno nuevo con Docker**:

1. Crear la base de datos en PostgreSQL (p. ej. **`BNPL`**) y usuario con permisos.
2. Copiar **`.env.example`** → **`.env`** y definir **`DATABASE_URL`** (y el resto si aplica).
3. `docker compose build`
4. `docker compose up -d`
5. Probar `GET /health` y `GET /api/tasas/ultimas`.
6. Si necesitas carga histórica CSV, ejecutar `docker compose run --rm api npm run db:import:prod`.

---

## 11. Operación continua con Docker

- **API:** servicio `api`, comando `npm run db:setup:prod && node dist/main.js`, con `restart: unless-stopped`.
- **BCV:** servicio `bcv-scheduler`, comando `node dist/scheduler.js`, vivo dentro de Docker y ejecutando en `BCV_SYNC_HOURS`.
- **CSV:** re-import cuando haya un archivo nuevo con `docker compose run --rm api npm run db:import:prod`.

Guía recomendada de despliegue: [docs/docker.md](./docs/docker.md).

---

## 12. Documentación adicional

| Documento | Contenido |
|-----------|-----------|
| [docs/postgresql.md](./docs/postgresql.md) | BD `BNPL`, esquema `DBO`, import CSV, orden de `id`. |
| [docs/bcv-scraper.md](./docs/bcv-scraper.md) | Sync BCV, variables, scheduler, SSL. |
| [docs/api-http.md](./docs/api-http.md) | Rutas GET, ejemplos, seguridad. |
| [docs/docker.md](./docs/docker.md) | Dockerfile, Compose, API y scheduler BCV dentro de Docker. |

---

## 13. Problemas frecuentes

| Síntoma | Acción |
|---------|--------|
| `Falta DATABASE_URL` | Crear `.env` desde `.env.example` y configurar la URL. |
| Error TLS al ejecutar `bcv:sync` | Actualizar `ca-certificates` en el SO o, como último recurso, `BCV_INSECURE_TLS=1` (riesgo MITM). |
| API `404` en `/api/tasas/ultimas` | Tabla vacía; ejecutar import CSV o `bcv:sync`. |
| `fecha_invalida` | Usar solo `YYYY-MM-DD` en `/api/tasas/fecha/...`. |
| CSV con columnas distintas | Renombrar cabeceras a `Cur Cod`, `Valid From`, `Rat Exc` o adaptar `src/import/csv-import.service.ts`. |

---

## Licencia y uso

Proyecto privado orientado a gestión interna de tasas. Asegúrate de cumplir los términos de uso del sitio del **BCV** y las políticas de tu organización al automatizar descargas y al exponer la API.
