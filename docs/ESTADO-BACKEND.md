# Estado del Backend — Fiskaria

Qué está **listo para integrar** y qué **falta**, mapeado contra los **11 módulos del SDD**.
Última actualización: **2026-06-20**.

> Para integrar el frontend en paralelo: lo **listo** se conecta a la API real ya; lo
> **pendiente** se construye contra las specs del SDD (`modulos/*/spec.md`, `arquitectura/apis.md`)
> y se conecta a medida que se entrega.

---

## Resumen

- ✅ **Listos: 3 módulos** (2 completos + 1 parcial) + **2 piezas administrativas** (Contribuyentes, Puntos de Emisión).
- ❌ **Faltan: 8 módulos** (incluido el núcleo, el Facturador).
- Avance estimado: **~42%**.

| # | Módulo (SDD) | Estado |
|---|---|---|
| 11 | Usuarios / Roles / Auditoría | 🟡 Parcial (auth + RBAC listos) |
| 6 | Clientes / Terceros | ✅ Listo |
| 5 | Inventario / Productos | ✅ Listo |
| — | Contribuyentes (alta) | ✅ Listo |
| — | Puntos de Emisión | ✅ Listo |
| 2 | Facturador | ❌ Falta (núcleo) |
| 3 | Ventas | ❌ Falta |
| 4 | Compras y retenciones | ❌ Falta |
| 7 | Contabilidad | ❌ Falta |
| 8 | SENIAT / Cumplimiento (libros) | ❌ Falta |
| 9 | Impuestos municipales | ❌ Falta |
| 10 | Imprenta Digital (panel) | ❌ Falta |
| 1 | Dashboard | ❌ Falta |

---

## ✅ Endpoints listos (integrables hoy)

Todos bajo `http://localhost:3000/api`. Salvo los marcados *(público)*, requieren
`Authorization: Bearer <token>`.

### Autenticación (módulo 11)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/login` *(público)* | Login → `{ accessToken, refreshToken, passwordTemporal }` |
| POST | `/auth/refresh` *(público)* | Renueva tokens |
| POST | `/auth/logout` | Cierra sesión (revoca refresh tokens) |
| POST | `/auth/cambiar-password` | Cambia contraseña `{ actual, nueva }` |
| GET | `/auth/me` | Usuario actual: roles, permisos, `contribuyenteId` |
| GET | `/health` *(público)* | Estado de la API y la BD |

### Contribuyentes (alta — rol Sirumatek)
| Método | Ruta | Permiso |
|---|---|---|
| POST | `/contribuyentes` | `contribuyentes:crear` |
| GET | `/contribuyentes` | `contribuyentes:ver` |
| GET | `/contribuyentes/:id` | `contribuyentes:ver` |
| POST | `/contribuyentes/:id/validar` | `contribuyentes:validar` |

### Puntos de Emisión
| Método | Ruta | Permiso |
|---|---|---|
| POST | `/puntos-emision` | `puntos-emision:crear` |
| GET | `/puntos-emision` | `puntos-emision:ver` |
| GET | `/puntos-emision/:id` | `puntos-emision:ver` |
| PATCH | `/puntos-emision/:id` | `puntos-emision:editar` |

### Terceros — clientes/proveedores (módulo 6)
| Método | Ruta | Permiso |
|---|---|---|
| POST | `/terceros` | `terceros:crear` |
| GET | `/terceros?tipo=cliente\|proveedor&q=` | `terceros:ver` |
| GET | `/terceros/:id` | `terceros:ver` |
| PATCH | `/terceros/:id` | `terceros:editar` |
| POST | `/terceros/:id/validar-rif` | `terceros:editar` |

### Inventario / Productos (módulo 5)
| Método | Ruta | Permiso |
|---|---|---|
| POST | `/productos` | `productos:crear` |
| GET | `/productos?q=&tipo=&bajoStock=true` | `productos:ver` |
| GET | `/productos/:id` | `productos:ver` |
| PATCH | `/productos/:id` | `productos:editar` |
| GET | `/categorias-fiscales` | `productos:ver` |
| GET | `/categorias-comerciales` | `productos:ver` |
| POST | `/categorias-comerciales` | `productos:crear` |

> El detalle exacto de cada request/response está en **Swagger** (`/api/docs`).

### Roles y permisos (semilla)
- **Administrador**: todo el comercio (excepto alta/validación de contribuyentes).
- **Operador**: facturas, ventas, inventario, productos, terceros.
- **Fiscal**: solo lectura (acciones `ver`).
- **Sirumatek**: soporte; incluye alta/validación de contribuyentes.

---

## ❌ Pendientes (mockear contra el SDD)

| Módulo | Qué incluirá |
|---|---|
| **2 · Facturador** (núcleo) | Emisión de factura/NC/ND/guía → numeración + Imprenta Digital + asiento + auditoría (transacción atómica) |
| **10 · Imprenta Digital** | Cliente de integración (6 endpoints) + panel de estado/transmisiones |
| **3 · Ventas** | Cotizaciones / ventas que derivan en factura |
| **4 · Compras y retenciones** | Compras, IVA crédito, retenciones IVA/ISLR |
| **7 · Contabilidad** | Asientos, plan de cuentas, Libros de Ventas/Compras |
| **8 · SENIAT / Cumplimiento** | Libros legales, declaraciones, carpeta de inspección |
| **9 · Impuestos municipales** | Actividades económicas, cálculo y pagos |
| **1 · Dashboard** | KPIs y resumen del período |
| **11 (resto)** | CRUD de usuarios, recuperación de clave (`/auth/recuperar`), consulta de auditoría (`/api/auditoria`) |
| **tasas-bcv** | Consumo del microservicio externo de tasas USD/EUR |

---

## 🧩 Piezas internas listas (no son pantallas, las usan los módulos)

- **Validador SENIAT** (`GET /rif/:rif`) — con modo mock para dev.
- **Numeración correlativa** sin saltos por punto de emisión y tipo (RN-006/128), probada bajo concurrencia.
- **`fiscal-utils`** — cálculo de IVA por alícuota, IGTF 3% y redondeo (con tests unitarios).
- **Auditoría** transversal (append-only) y **RBAC** por permisos `modulo:accion`.
- **Manejo de errores** uniforme: `{ error, mensaje, statusCode, path, timestamp }`.

---

## ⚠️ Decisiones/supuestos a confirmar (no bloquean el frontend)

- **Categorías fiscales**: sembradas provisionalmente (16% / 8% / 31% / Exento / Exonerado) — pendiente lista oficial del revisor fiscal.
- **`periodo_iva`**: derivado como Especial→quincenal, resto→mensual (RN-130, a confirmar).
- **Política SENIAT 503 al dar de alta**: se permite alta "pendiente de validación" (`validado:false`).
- **IVA**: se calcula agrupando por alícuota (desglose tipo factura SENIAT).
