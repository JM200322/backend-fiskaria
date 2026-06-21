# Estado del Backend — Fiskaria

Qué está **listo para integrar** y qué **falta**, mapeado contra los **11 módulos del SDD**.
Última actualización: **2026-06-21**.

> Para integrar el frontend en paralelo: lo **listo** se conecta a la API real ya; lo
> **pendiente** se construye contra las specs del SDD (`modulos/*/spec.md`, `arquitectura/apis.md`)
> y se conecta a medida que se entrega.

---

## Resumen

- ✅ **Listos: 9 módulos completos** + **2 parciales** (con su parte central ya usable).
- ❌ **Falta: 1 módulo** (SENIAT/Cumplimiento) + el panel de Imprenta.
- Avance estimado: **~88%**.

| # | Módulo (SDD) | Estado |
|---|---|---|
| — | Contribuyentes (alta) | ✅ Listo |
| — | Puntos de Emisión | ✅ Listo |
| 6 | Clientes / Terceros | ✅ Listo |
| 5 | Inventario / Productos | ✅ Listo |
| 4 | Compras y Retenciones | ✅ Listo (falta retenciones *recibidas*) |
| 3 | Ventas | ✅ Listo |
| 9 | Impuestos municipales | ✅ Listo |
| 1 | Dashboard | ✅ Listo |
| 11 | Usuarios / Roles / Auditoría | ✅ Listo (falta envío SMTP de clave temporal) |
| 2 | Facturador | 🟡 Parcial — Factura + NC/ND ✅ (falta guía despacho, contingencia, PDF) |
| 7 | Contabilidad | 🟡 Parcial — plan de cuentas, asientos y libros ✅ (falta posteo automático y TXT/XML) |
| 10 | Imprenta Digital | 🟡 Integración interna ✅ (modo mock); falta el panel |
| 8 | SENIAT / Cumplimiento (exportadores) | ❌ Falta (formato TXT/XML pendiente) |

---

## ✅ Endpoints listos (integrables hoy)

Todos bajo `http://localhost:3000/api`. Salvo los marcados *(público)*, requieren
`Authorization: Bearer <token>`. El detalle exacto de request/response está en **Swagger**
(`/api/docs`).

### Autenticación (módulo 11)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/login` *(público)* | Login → `{ accessToken, refreshToken, passwordTemporal }` |
| POST | `/auth/refresh` *(público)* | Renueva tokens |
| POST | `/auth/logout` | Cierra sesión (revoca refresh tokens) |
| POST | `/auth/cambiar-password` | Cambia contraseña `{ actual, nueva }` |
| POST | `/auth/recuperar` *(público)* | Recuperación: clave temporal `{ email }` (RN-014) |
| GET | `/auth/me` | Usuario actual: roles, permisos, `contribuyenteId` |
| GET | `/health` *(público)* | Estado de la API y la BD |

### Usuarios y auditoría (módulo 11)
| Método | Ruta | Permiso |
|---|---|---|
| POST | `/usuarios` | `usuarios:crear` (devuelve clave temporal) |
| GET | `/usuarios` · `/usuarios/:id` | `usuarios:ver` |
| PATCH | `/usuarios/:id` | `usuarios:editar` |
| POST | `/usuarios/:id/reset-password` | `usuarios:editar` |
| GET | `/auditoria?accion=&entidad=` | `usuarios:ver` |

### Contribuyentes (alta — rol Sirumatek)
| Método | Ruta | Permiso |
|---|---|---|
| POST | `/contribuyentes` | `contribuyentes:crear` |
| GET | `/contribuyentes` · `/contribuyentes/:id` | `contribuyentes:ver` |
| POST | `/contribuyentes/:id/validar` | `contribuyentes:validar` |

### Puntos de Emisión
| Método | Ruta | Permiso |
|---|---|---|
| POST | `/puntos-emision` | `puntos-emision:crear` |
| GET | `/puntos-emision` · `/puntos-emision/:id` | `puntos-emision:ver` |
| PATCH | `/puntos-emision/:id` | `puntos-emision:editar` |

### Terceros — clientes/proveedores (módulo 6)
| Método | Ruta | Permiso |
|---|---|---|
| POST | `/terceros` | `terceros:crear` |
| GET | `/terceros?tipo=cliente\|proveedor&q=` · `/terceros/:id` | `terceros:ver` |
| PATCH | `/terceros/:id` | `terceros:editar` |
| POST | `/terceros/:id/validar-rif` | `terceros:editar` |

### Inventario / Productos (módulo 5)
| Método | Ruta | Permiso |
|---|---|---|
| POST | `/productos` | `productos:crear` |
| GET | `/productos?q=&tipo=&bajoStock=true` · `/productos/:id` | `productos:ver` |
| PATCH | `/productos/:id` | `productos:editar` |
| GET | `/categorias-fiscales` · `/categorias-comerciales` | `productos:ver` |
| POST | `/categorias-comerciales` | `productos:crear` |

### Facturador (módulo 2) — Factura + NC/ND
| Método | Ruta | Permiso |
|---|---|---|
| POST | `/documentos/factura` | `facturas:crear` |
| POST | `/documentos/nota-credito` | `facturas:crear` |
| POST | `/documentos/nota-debito` | `facturas:crear` |
| POST | `/documentos/:id/reintentar` | `facturas:crear` |
| GET | `/documentos?tipo=&estatus=` · `/documentos/:id` | `facturas:ver` |

> Documentos **inmutables**: no hay `PATCH`/`DELETE`. Si la imprenta no responde, el
> documento queda `NO_ENVIADO` (sin `numeroControl`) y se reintenta. La factura siempre en Bs;
> `tasaBcv` se envía en el body y se persiste.

### Compras y Retenciones (módulo 4)
| Método | Ruta | Permiso |
|---|---|---|
| POST | `/compras` | `compras:crear` |
| GET | `/compras` · `/compras/:id` | `compras:ver` |
| POST | `/compras/:id/pagos` | `compras:crear` |
| POST | `/retenciones/iva` · `/retenciones/islr` | `compras:crear` |
| GET | `/retenciones` | `compras:ver` |

> Las retenciones solo las emite un **agente de retención** (403 si no lo es) y referencian
> la **factura del proveedor** (requieren su `numeroControl`).

### Contabilidad (módulo 7) — plan, asientos, libros
| Método | Ruta | Permiso |
|---|---|---|
| POST | `/plan-cuentas` | `contabilidad:crear` |
| GET | `/plan-cuentas` | `contabilidad:ver` |
| POST | `/config-cuentas` | `contabilidad:crear` |
| GET | `/config-cuentas` | `contabilidad:ver` |
| POST | `/asientos` | `contabilidad:crear` |
| GET | `/asientos` | `contabilidad:ver` |
| GET | `/libros/ventas?year=&month=` | `contabilidad:ver` |
| GET | `/libros/compras?year=&month=` | `contabilidad:ver` |
| GET | `/declaraciones/iva?year=&month=` | `contabilidad:ver` |

### Ventas (módulo 3) — ciclo comercial → factura
| Método | Ruta | Permiso |
|---|---|---|
| POST | `/ventas` | `ventas:crear` (cotización) |
| GET | `/ventas?estado=` · `/ventas/:id` | `ventas:ver` |
| POST | `/ventas/:id/confirmar` | `ventas:crear` |
| POST | `/ventas/:id/anular` | `ventas:anular` |
| POST | `/ventas/:id/facturar` | `facturas:crear` (convierte en factura) |

> Una cotización **no** genera documento fiscal ni descuenta stock; eso ocurre al **facturar**.

### Impuestos Municipales (módulo 9)
| Método | Ruta | Permiso |
|---|---|---|
| POST | `/actividades-economicas` | `municipales:crear` |
| GET | `/actividades-economicas` | `municipales:ver` |
| POST | `/impuestos-municipales` | `municipales:crear` (calcula base × alícuota) |
| GET | `/impuestos-municipales?estado=` | `municipales:ver` |
| POST | `/impuestos-municipales/:id/pagar` | `municipales:pagar` |

### Dashboard (módulo 1)
| Método | Ruta | Permiso |
|---|---|---|
| GET | `/dashboard/resumen` | `dashboard:ver` |
| GET | `/dashboard/ventas?rango=7d\|30d\|anio` | `dashboard:ver` |

> `/resumen`: ventas del mes, situación fiscal (débito − crédito − retenciones) y alertas
> (stock crítico, documentos "no enviado"). `/ventas`: serie para el gráfico.

### Roles y permisos (semilla)
- **Administrador**: todo el comercio (excepto alta/validación de contribuyentes).
- **Operador**: facturas, ventas, inventario, productos, terceros.
- **Contador**: contabilidad, compras, proveedores, reportes.
- **Fiscal**: solo lectura (acciones `ver`).
- **Sirumatek**: soporte; incluye alta/validación de contribuyentes.

---

## ❌ Pendientes (mockear contra el SDD)

| Módulo | Qué incluirá |
|---|---|
| **8 · SENIAT / Cumplimiento** | Exportadores de libros legales, declaraciones, carpeta de inspección (formato TXT/XML pendiente del revisor fiscal) |
| **10 · Imprenta (panel)** | Pantalla de estado de transmisiones / documentos "no enviado" |
| **2 · Facturador (resto)** | Guía de despacho, factura en contingencia, PDF protegido |
| **4 · Compras (resto)** | Retenciones *recibidas* (las que practican los clientes) |
| **7 · Contabilidad (resto)** | Posteo automático de asientos, TXT/XML Providencia 00071, Balance General |
| **11 (resto)** | Envío por **SMTP** de la clave temporal (hoy se entrega en dev) |
| **tasas-bcv** | Consumo del microservicio externo de tasas USD/EUR |

---

## 🧩 Piezas internas listas (no son pantallas, las usan los módulos)

- **Validador SENIAT** (`GET /rif/:rif`) — con modo mock para dev (`SENIAT_MOCK`).
- **Imprenta Digital** — adaptador con modo mock (`IMPRENTA_MOCK`); emite factura, NC, ND y retenciones IVA/ISLR.
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
- **Pagos de factura**: deben sumar el total (sin IGTF); el **IGTF 3%** se calcula sobre los pagos en divisas.
- **NC/ND**: la NC por devolución reingresa stock; ambas con IGTF 0 (a confirmar).
- **Retenciones**: porcentaje como parámetro (default IVA 75%, ISLR 3%) — exacto pendiente del revisor fiscal.
