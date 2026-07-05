# Sincronización diaria con la portada del BCV

El comando CLI NestJS **`npm run bcv:sync`** usa `src/bcv/bcv-sync.service.ts` y hace lo siguiente:

1. Descarga la portada del BCV (`BCV_PAGE_URL`, por defecto `https://www.bcv.org.ve/`).
2. Lee solo **EUR** y **USD** del bloque *tipo de cambio oficial* (no procesa CNY, TRY ni RUB).
3. Obtiene la **fecha de valor** del atributo `content` de `span.date-display-single` (solo el día, formato `YYYY-MM-DD`).
4. Consulta PostgreSQL (`DATABASE_URL`, misma base que el resto del proyecto): si **ya existen** una fila **EUR** y una fila **USD** para esa `valid_from`, **no inserta ni actualiza** nada.
5. Si falta alguna de las dos (o ninguna), hace `INSERT … ON CONFLICT DO UPDATE` en **`"DBO".tasas_diarias`**.

## Requisitos

- Tabla creada (`npm run db:setup`).
- `.env` con **`DATABASE_URL`** correcto.

## Ejecución manual

```bash
npm run bcv:sync
```

Internamente ejecuta `ts-node -r tsconfig-paths/register src/cli.ts bcv:sync`.

## Programación automática en Docker

En producción, la programación no depende de `cron` del host. La hace el servicio **`bcv-scheduler`** definido en `docker-compose.yml`:

```bash
docker compose up -d bcv-scheduler
```

Variables usadas por el scheduler:

| Variable | Descripción |
|----------|-------------|
| `BCV_SYNC_HOURS` | Horas del día para ejecutar scraping, separadas por coma. Default en Compose: `8,14,20`. |
| `BCV_SYNC_RUN_ON_START` | Si vale `1`, ejecuta un sync al arrancar el contenedor. Default: `0`. |
| `TZ` | Zona horaria del contenedor. En Compose se usa `America/Caracas`. |

Para desarrollo también puedes ejecutar `npm run bcv:sync` manualmente.

### Sobre “no scrapear” si ya existe la fecha

El comando **sí descarga la página** en cada ejecución para conocer la **fecha de valor** que publica el BCV hoy y las tasas vigentes. Lo que evita es **escribir en la base** cuando para esa fecha ya hay **EUR y USD**. Así las tres pasadas diarias no duplican trabajo en PostgreSQL cuando el día ya está cargado.

Si en tu red falla el certificado SSL del sitio, puedes usar (solo si lo aceptas a nivel de seguridad):

```env
BCV_INSECURE_TLS=1
```

## Variables de entorno opcionales

| Variable | Descripción |
|----------|-------------|
| `BCV_PAGE_URL` | URL a descargar (por defecto `https://www.bcv.org.ve/`). |
| `BCV_INSECURE_TLS=1` | Desactiva la verificación estricta del certificado TLS del cliente HTTPS. |

## Relación con el resto del proyecto

- Misma tabla que el import CSV: **`"DBO".tasas_diarias"`**. Si el CSV y el BCV usan la misma `valid_from`, el último proceso que haga `INSERT`/`UPDATE` dejará el `rat_exc` que corresponda a su fuente (el servicio BCV usa `ON CONFLICT DO UPDATE`).

Para la base de datos en general, sigue [postgresql.md](./postgresql.md).
