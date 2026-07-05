# PostgreSQL: esquema DBO y tasas diarias

Este proyecto NestJS guarda las tasas de cambio diarias (EUR y USD) del CSV **Listado de Tasas Diarias.csv** en PostgreSQL usando TypeORM. La base de datos prevista se llama **`BNPL`** (el nombre concreto va en `DATABASE_URL`). Los datos de tasas viven en el esquema **`DBO`** y la tabla **`tasas_diarias`**.

Para sincronizar **EUR/USD** desde la portada del BCV con el scheduler Docker (≥3 veces al día), consulta **[bcv-scraper.md](./bcv-scraper.md)**.

Para la **API HTTP** de consulta de tasas (`GET`), consulta **[api-http.md](./api-http.md)**.

## Requisitos

- [Node.js](https://nodejs.org/) 18 o superior (recomendado LTS).
- Servidor [PostgreSQL](https://www.postgresql.org/) accesible desde tu máquina (local o remoto).

## Pasos en un entorno nuevo

### 1. Base de datos **BNPL**

El proyecto está alineado con una base de datos llamada **`BNPL`**. Si aún no existe en tu servidor, créala conectándote con `psql` u otro cliente (como superusuario o con permisos suficientes):

```sql
CREATE DATABASE "BNPL";
```

En PostgreSQL, sin comillas el nombre se normaliza a minúsculas (`bnpl`). Si tu servidor ya tiene la base creada como `bnpl`, usa esa misma grafía al final de `DATABASE_URL` (por ejemplo `.../bnpl`).

Si la base ya existe (por ejemplo la comparte otro servicio), el usuario de `DATABASE_URL` debe poder crear el esquema `DBO` y las tablas dentro de esa base.

Ajusta usuario, contraseña y permisos según tu política de seguridad.

### 2. Configurar variables de entorno

En la raíz del proyecto:

```bash
cp .env.example .env
```

Edita `.env` y define **`DATABASE_URL`** con tu cadena de conexión, por ejemplo:

```text
postgresql://USUARIO:CONTRASEÑA@HOST:5432/BNPL
```

Opcionalmente define **`CSV_PATH`** si el CSV no está en la raíz del proyecto con el nombre por defecto.

### 3. Instalar dependencias de Node

Desde la raíz del proyecto:

```bash
npm install
```

### 4. Crear esquema **DBO** y tabla **tasas_diarias**

La migración TypeORM `CreateTasasDiarias...` aplica el DDL en este orden:

1. **`CREATE SCHEMA IF NOT EXISTS "DBO"`** — crea el esquema **DBO** solo si no existe. Si ya está creado (por otro despliegue o manualmente), **no lo modifica** ni falla.
2. **`CREATE TABLE IF NOT EXISTS "DBO"."tasas_diarias"`** — crea la tabla **solo dentro de ese esquema**. Si la tabla ya existe, **no la recrea** (no borra datos).

Ejecuta la migración de aprovisionamiento (no elimina objetos ni datos existentes):

```bash
npm run db:setup
```

La tabla **`DBO.tasas_diarias`** tiene las columnas:

| Columna     | Tipo           | Descripción                          |
|------------|----------------|--------------------------------------|
| `id`       | `bigserial`    | Identificador interno              |
| `cur_cod`  | `varchar(3)`   | Moneda (`EUR`, `USD`, …)           |
| `valid_from` | `date`        | Día de vigencia (solo fecha)       |
| `rat_exc`  | `numeric(18,6)`| Tasa de cambio                     |
| `created_at` | `timestamptz` | Marca de inserción                 |

Restricción única: **`(cur_cod, valid_from)`** para evitar duplicados al importar.

### 5. (Opcional) Importar el CSV completo

```bash
npm run db:import
```

Las filas que ya existan para la misma moneda y fecha se **actualizan** (`rat_exc`); el resto se inserta.

Antes de insertar, el script **ordena** por `valid_from` ascendente y luego por `cur_cod`, de modo que el **`id`** (`bigserial`) aumente con el tiempo de negocio: la fila con la fecha más reciente queda con el **mayor `id`** en una carga inicial completa (tabla vacía). El CSV puede traer las fechas en cualquier orden.

Si vuelves a importar sobre datos ya cargados, las filas que ya existen **conservan su `id`** (solo se actualiza la tasa); solo las filas nuevas reciben `id` nuevos mayores que el máximo actual.

## Migración a otro ambiente

1. Copia el proyecto (o el repositorio) al nuevo servidor o máquina.
2. Repite los pasos de esta guía: base de datos, `.env`, `npm install`, `npm run db:setup`.
3. Si necesitas los datos históricos, coloca el CSV y ejecuta `npm run db:import`.

No hace falta volcar el esquema a mano si usas siempre `npm run db:setup`: el script es idempotente para el esquema y la tabla.

## Resumen rápido de comandos

```bash
cp .env.example .env   # y editar DATABASE_URL
npm install
npm run db:setup       # DDL
npm run db:import      # carga CSV (opcional)
```

## Notas sobre fechas del CSV

El campo **Valid From** viene en español (por ejemplo `mayo 14, 2026, 12:00 a. m.`). El script extrae solo la **fecha calendario** y la guarda como tipo `date` en PostgreSQL (la hora del CSV se ignora, coherente con un listado diario).

Si en el futuro cambia el formato de fecha, habrá que ajustar la función de parseo en `src/import/csv-import.service.ts`.
