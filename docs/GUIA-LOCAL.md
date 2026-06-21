# Guía para correr el Backend en local

Backend de **Fiskaria** (Sistema de Facturación) — **NestJS + PostgreSQL + Prisma**.
Esta guía es para levantar la API en tu máquina y consumirla desde el frontend.

> El backend es un **repositorio independiente** del frontend. La especificación funcional
> (qué hace cada endpoint) vive en el repo **SDD** (`modulos/*/spec.md` y `arquitectura/apis.md`).

---

## 1. Requisitos

- **Node.js >= 20** (probado en Node 24).
- **Docker Desktop** (para PostgreSQL, Redis y MinIO). Debe estar **corriendo** (ícono de la ballena estable).

---

## 2. Puesta en marcha (paso a paso)

Desde la carpeta del backend:

```bash
# 1. Instalar dependencias
npm install

# 2. Crear el archivo de entorno (copia la plantilla)
#    Windows PowerShell:
copy .env.example .env
#    Git Bash / Mac / Linux:
cp .env.example .env

# 3. Levantar los servicios (PostgreSQL + Redis + MinIO)
npm run db:up

# 4. Aplicar las migraciones (crea las tablas)
npx prisma migrate deploy

# 5. Cargar datos iniciales (roles, permisos, usuarios, catálogos demo)
npx prisma db seed

# 6. Arrancar la API en modo desarrollo (recarga en caliente)
npm run start:dev
```

Cuando veas en consola `API escuchando en http://localhost:3000/api`, ya está listo.

---

## 3. URLs y accesos

| Recurso | URL |
|---|---|
| API base | `http://localhost:3000/api` |
| **Swagger (documentación interactiva)** | `http://localhost:3000/api/docs` |
| Healthcheck | `http://localhost:3000/api/health` |
| Consola MinIO (S3) | `http://localhost:9001` (usuario/clave: `minioadmin`) |
| Prisma Studio (ver la BD) | `npm run prisma:studio` |

### Usuarios de prueba (del seed)

| Email | Clave | Rol | Notas |
|---|---|---|---|
| `admin@sirumatek.com` | `Admin1234` | Administrador | Usuario del **comercio demo** |
| `soporte@sirumatek.com` | `Soporte1234` | Sirumatek | Soporte (acceso multi-comercio) |

---

## 4. Cómo consumir la API (autenticación)

La API usa **JWT (Bearer token)**. Flujo:

**1) Login** → devuelve `accessToken` y `refreshToken`:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sirumatek.com","password":"Admin1234"}'
```
```json
{ "accessToken": "eyJ...", "refreshToken": "eyJ...", "passwordTemporal": false }
```

**2) Llamar endpoints protegidos** con el header `Authorization`:
```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

**3) Renovar** el access token cuando expire (dura 15 min) con el refresh token:
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}'
```

> El `accessToken` ya incluye el rol y el `contribuyenteId`; cada endpoint queda acotado al
> comercio del usuario (multi-tenant). Los permisos vienen en `GET /api/auth/me`
> (`permisos: ["facturas:crear", ...]`) — útil para mostrar/ocultar acciones en la UI.

---

## 5. CORS (importante para el frontend)

Por defecto el backend permite el origen `http://localhost:3001`. Si tu frontend corre en
otro puerto, edítalo en `.env`:

```
CORS_ORIGINS=http://localhost:3001,http://localhost:5173
```

---

## 6. Notas de desarrollo

- **Validación SENIAT en modo mock** (`SENIAT_MOCK=true`): evita golpear la API real del
  gobierno. En mock, un RIF que contenga `404` simula "no encontrado", `503` simula "servicio
  caído", y `777` simula contribuyente "Especial"; cualquier otro RIF válido se da por validado.
- **Imprenta Digital en modo mock** (`IMPRENTA_MOCK=true`): simula el número de control sin
  llamar a la imprenta real (cuyo contrato aún está incompleto). Para probar el camino
  "no enviado", un RIF de cliente/proveedor que contenga `999` hace fallar la imprenta.
- **Tasas BCV en modo mock** (`TASAS_BCV_MOCK=true`): no llama al microservicio externo;
  devuelve USD 523.675 / EUR 598.12. El campo `tasaBcv` al emitir factura/guía es **opcional**:
  si se omite, el backend toma la tasa del servicio. Si el micro real no responde, usa la
  última tasa conocida en caché.
- **Datos del seed**: además de los usuarios y roles, crea un **comercio demo** (RIF
  `J-00000000-0`), un **punto de emisión** (`01`) y un catálogo de **categorías fiscales**
  (16% / 8% / 31% / Exento / Exonerado). Ya puedes facturar contra ese comercio.
- **Montos**: el dinero se devuelve como string con 2 decimales (ej. `"19011.71"`); la factura
  siempre va en bolívares.
- **Rate limiting**: configurable con `THROTTLE_LIMIT` (peticiones/min por IP); en dev viene alto.
- **Clave temporal (RN-014)**: al crear un usuario (`POST /api/usuarios`) o al recuperar
  acceso (`POST /api/auth/recuperar`), se genera una **clave temporal** y el usuario queda con
  `passwordTemporal: true` (visible en el login y en `/auth/me`). El frontend debe **forzar el
  cambio** vía `POST /api/auth/cambiar-password`. Aún no hay SMTP: en dev la clave se devuelve
  en la respuesta para poder probar el flujo.

---

## 7. Comandos útiles

| Comando | Acción |
|---|---|
| `npm run start:dev` | API con recarga en caliente |
| `npm run db:up` / `npm run db:down` | Levantar / detener los contenedores Docker |
| `npx prisma studio` | Explorador visual de la base de datos |
| `npx prisma migrate deploy` | Aplicar migraciones |
| `npx prisma db seed` | Recargar datos iniciales |
| `npm test` | Ejecutar tests unitarios |

---

## 8. Problemas comunes

| Síntoma | Causa / solución |
|---|---|
| `EADDRINUSE :3000` | El puerto está ocupado. Cierra el proceso anterior o cambia `PORT` en `.env`. |
| `Can't reach database server` | Docker no está corriendo o no hiciste `npm run db:up`. |
| `TLS handshake timeout` al hacer `docker compose` | Problema de red/proxy de Docker con Docker Hub. Reinicia Docker Desktop; revisa Settings → Resources → Proxies. |
| `EPERM ... query_engine` al migrar | Hay un proceso Node (watcher) bloqueando Prisma. Detén `start:dev` antes de migrar. |
| 401 en todos los endpoints | Falta el header `Authorization: Bearer <token>` o el token expiró (renueva con `/auth/refresh`). |
| 403 "Permisos insuficientes" | El rol del usuario no tiene ese permiso (es lo esperado; revisa el rol). |
