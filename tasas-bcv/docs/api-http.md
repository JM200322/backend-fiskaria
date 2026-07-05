# API HTTP (consulta de tasas)

API construida con **NestJS** que lee **`"DBO".tasas_diarias`** usando **`DATABASE_URL`**.

## Arranque

Recomendado con Docker:

```bash
docker compose up -d api
```

Para desarrollo local:

```bash
npm install
npm run api:start
```

`npm run api:start` ejecuta `nest start` y levanta `src/main.ts`.

Variables opcionales en **`.env`**:

| Variable   | Default      | Descripción                          |
|-----------|--------------|--------------------------------------|
| `API_PORT` | `3000`       | Puerto TCP                           |
| `API_HOST` | `127.0.0.1`  | Interfaz de escucha (`0.0.0.0` en VPS/proxy) |

## Rutas (solo GET)

### Salud

- **`GET /health`**  
  Respuesta: `{ "ok": true, "servicio": "tasas-bcv-api" }`

### Últimas tasas del día más reciente en base de datos

- **`GET /api/tasas/ultimas`**

Usa el **`MAX(valid_from)`** de la tabla y devuelve **EUR** y **USD** para esa fecha (si falta una moneda, su valor será `null`).

Ejemplo:

```http
GET http://127.0.0.1:3000/api/tasas/ultimas
```

Respuesta (200):

```json
{
  "fecha": "2026-05-14",
  "EUR": {
    "id": "123",
    "cur_cod": "EUR",
    "valid_from": "2026-05-14",
    "rat_exc": "598.121713",
    "created_at": "2026-05-14T18:56:18.535Z"
  },
  "USD": {
    "id": "124",
    "cur_cod": "USD",
    "valid_from": "2026-05-14",
    "rat_exc": "510.787300",
    "created_at": "2026-05-14T18:56:18.535Z"
  }
}
```

Si la tabla está vacía: **404** con `error: "sin_datos"`.

### Tasas por fecha concreta

- **`GET /api/tasas/fecha/:fecha`**

`fecha` debe ser **`YYYY-MM-DD`**.

Ejemplo:

```http
GET http://127.0.0.1:3000/api/tasas/fecha/2026-05-10
```

- **200**: mismo cuerpo que arriba (`fecha`, `EUR`, `USD`; puede haber `null` si solo existe una moneda para ese día).
- **400**: formato de fecha inválido.
- **404**: no hay ninguna fila EUR/USD para esa fecha.

## Seguridad

Por defecto el servicio escucha en **localhost**. Si expones `API_HOST=0.0.0.0`, coloca firewall, VPN o un proxy inverso con autenticación según tu entorno; esta API **no incluye** login ni API keys.

## Relación con otros scripts

Los datos los cargan `npm run db:import` / `npm run bcv:sync` en desarrollo, o `api` / `bcv-scheduler` en Docker. La API solo **consulta** PostgreSQL.
