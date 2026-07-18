import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import * as mock from './sigat.mock';
import { ACTIVIDADES_ECONOMICAS, METODOS_PAGO, resolverCatalogo } from './sigat.catalogos';
import {
  SigatConsolidadoAlcaldia,
  SigatContribuyente,
  SigatDocumento,
  SigatError,
  SigatEstado,
  SigatLicenciaActiva,
  SigatLicenciaDetalle,
  SigatObligaciones,
  SigatRawConsolidadoItem,
  SigatRawContribuyente,
  SigatRawError,
  SigatRawLicenciaActivaItem,
  SigatRawLicenciaDetalle,
  SigatRawObligaciones,
  SigatRawVehiculo,
  SigatTipoVehiculo,
  SigatVehiculo,
} from './sigat.types';

/**
 * Adaptador de SIGAT (capa anticorrupción): aísla el contrato del API municipal
 * y el transporte HTTP. Auth = X-Api-Key (secreto global) + X-Contribuyente-Id
 * (id interno del comercio en SIGAT, resuelto desde su RIF y cacheado). RN-140.
 *
 * Modo mock (dev): SIGAT_MOCK=true devuelve datos de ejemplo sin golpear la API.
 */
@Injectable()
export class SigatService {
  private readonly logger = new Logger(SigatService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Contribuyente ─────────────────────────────────────────────────────────

  /** Consulta un contribuyente por RIF (solo requiere API key). */
  async consultarPorRif(rif: string): Promise<SigatContribuyente> {
    if (this.mockActivo()) return this.mapContribuyente(mock.contribuyente(rif));
    const raw = await this.get<SigatRawContribuyente>('/alcaldia/contribuyente/consulta', {
      query: { rif },
    });
    return this.mapContribuyente(raw);
  }

  /** Perfil SIGAT del comercio autenticado (resuelto desde su propio RIF). */
  async miContribuyente(contribuyenteId: string): Promise<SigatContribuyente> {
    const row = await this.prisma.contribuyente.findUnique({
      where: { id: contribuyenteId },
      select: { rif: true },
    });
    if (!row) throw new SigatError('Comercio no encontrado');
    return this.consultarPorRif(row.rif);
  }

  async consolidadoFinanciero(contribuyenteId: string): Promise<SigatConsolidadoAlcaldia[]> {
    if (this.mockActivo()) return mock.consolidado().map((r) => this.mapConsolidado(r));
    const sigatId = await this.resolverSigatId(contribuyenteId);
    const raw = await this.get<SigatRawConsolidadoItem[]>(
      '/contribuyente/alcaldias/consolidado-financiero',
      { sigatId },
    );
    return (raw ?? []).map((r) => this.mapConsolidado(r));
  }

  async obligaciones(contribuyenteId: string, alcaldiaId: number): Promise<SigatObligaciones> {
    if (this.mockActivo()) return this.mapObligaciones(mock.obligaciones());
    const sigatId = await this.resolverSigatId(contribuyenteId);
    const raw = await this.get<SigatRawObligaciones>(
      `/contribuyente/alcaldias/${alcaldiaId}/obligaciones-tributarias`,
      { sigatId },
    );
    return this.mapObligaciones(raw);
  }

  // ── Licencias ─────────────────────────────────────────────────────────────

  async licenciasActivas(contribuyenteId: string): Promise<SigatLicenciaActiva[]> {
    if (this.mockActivo()) return mock.licenciasActivas().map((r) => this.mapLicenciaActiva(r));
    const sigatId = await this.resolverSigatId(contribuyenteId);
    const raw = await this.get<SigatRawLicenciaActivaItem[]>(
      '/alcaldia/contribuyente/licencias-activas',
      { sigatId },
    );
    return (raw ?? []).map((r) => this.mapLicenciaActiva(r));
  }

  // SIGAT valida ownership del recurso contra el X-Contribuyente-Id: un id ajeno
  // devuelve 403 "No tiene acceso al recurso solicitado" (verificado en staging).
  async licencia(contribuyenteId: string, licenciaId: number): Promise<SigatLicenciaDetalle> {
    if (this.mockActivo()) return this.mapLicenciaDetalle(mock.licenciaDetalle(licenciaId));
    const sigatId = await this.resolverSigatId(contribuyenteId);
    const raw = await this.get<SigatRawLicenciaDetalle>(
      `/contribuyente/licencias/${licenciaId}`,
      { sigatId },
    );
    return this.mapLicenciaDetalle(raw);
  }

  // ── Vehículos ─────────────────────────────────────────────────────────────

  /** Catálogo de tipos de vehículo de una alcaldía (solo requiere API key). */
  async tiposVehiculo(alcaldiaId: number): Promise<SigatTipoVehiculo[]> {
    if (this.mockActivo()) return mock.tiposVehiculo();
    const raw = await this.get<SigatTipoVehiculo[]>(`/alcaldias/${alcaldiaId}/tipos-vehiculo`, {});
    return raw ?? [];
  }

  async vehiculo(contribuyenteId: string, vehiculoId: number): Promise<SigatVehiculo> {
    if (this.mockActivo()) return this.mapVehiculo(mock.vehiculo(vehiculoId));
    const sigatId = await this.resolverSigatId(contribuyenteId);
    const raw = await this.get<SigatRawVehiculo>(`/contribuyente/vehiculos/${vehiculoId}`, {
      sigatId,
    });
    return this.mapVehiculo(raw);
  }

  // ── Documentos ────────────────────────────────────────────────────────────

  async documentos(contribuyenteId: string): Promise<SigatDocumento[]> {
    if (this.mockActivo()) return mock.documentos();
    const sigatId = await this.resolverSigatId(contribuyenteId);
    const raw = await this.get<SigatDocumento[]>('/contribuyente/documentos', { sigatId });
    return raw ?? [];
  }

  // ── Estado de conexión ────────────────────────────────────────────────────

  async verificarConexion(): Promise<SigatEstado> {
    const verificadoEn = new Date().toISOString();

    if (this.mockActivo()) {
      return { estado: 'mock', mock: true, mensaje: 'Modo simulación SIGAT activo', verificadoEn };
    }
    if (!this.apiKey()) {
      return {
        estado: 'unconfigured',
        mock: false,
        mensaje: 'Configure SIGAT_API_KEY para conectar con la alcaldía',
        verificadoEn,
      };
    }

    const inicio = Date.now();
    try {
      // Sonda liviana: catálogo público de tipos de vehículo (solo API key).
      await this.get<unknown>('/alcaldias/1/tipos-vehiculo', {}, 5000);
      return {
        estado: 'connected',
        mock: false,
        mensaje: 'SIGAT responde',
        verificadoEn,
        latenciaMs: Date.now() - inicio,
      };
    } catch (e) {
      if (e instanceof SigatError && e.codigo && e.codigo < 500) {
        return {
          estado: 'degraded',
          mock: false,
          mensaje: `SIGAT respondió con código ${e.codigo}`,
          verificadoEn,
          latenciaMs: Date.now() - inicio,
        };
      }
      return { estado: 'offline', mock: false, mensaje: 'No se pudo contactar a SIGAT', verificadoEn };
    }
  }

  // ── Resolución del id SIGAT (lazy + cache) ────────────────────────────────

  /**
   * Devuelve el id interno del comercio en SIGAT; lo resuelve desde el RIF y lo cachea.
   * ponytail: dos requests concurrentes del mismo comercio podrían resolver dos veces
   * (idempotente, mismo id) — sin lock; agregar un in-flight promise si molesta la doble llamada.
   */
  private async resolverSigatId(contribuyenteId: string): Promise<number> {
    const row = await this.prisma.contribuyente.findUnique({
      where: { id: contribuyenteId },
      select: { rif: true, sigatContribuyenteId: true },
    });
    if (!row) throw new SigatError('Comercio no encontrado');
    if (row.sigatContribuyenteId != null) return row.sigatContribuyenteId;

    const sigat = await this.consultarPorRif(row.rif);
    if (!sigat.id) {
      throw new SigatError(`El RIF ${row.rif} no está registrado en SIGAT`, 404);
    }
    await this.prisma.contribuyente.update({
      where: { id: contribuyenteId },
      data: { sigatContribuyenteId: sigat.id },
    });
    return sigat.id;
  }

  // ── Transporte HTTP ───────────────────────────────────────────────────────

  private mockActivo(): boolean {
    return this.config.get<boolean>('sigat.mock') === true;
  }

  private baseUrl(): string {
    return (this.config.get<string>('sigat.baseUrl') ?? '').replace(/\/+$/, '');
  }

  private apiKey(): string {
    return this.config.get<string>('sigat.apiKey')?.trim() ?? '';
  }

  private async get<T>(
    ruta: string,
    opts: { query?: Record<string, string>; sigatId?: number },
    timeoutOverrideMs?: number,
  ): Promise<T> {
    const apiKey = this.apiKey();
    if (!apiKey) throw new SigatError('SIGAT_API_KEY no configurada');
    const base = this.baseUrl();
    if (!base) throw new SigatError('SIGAT_BASE_URL no configurada');

    const url = new URL(`${base}${ruta}`);
    for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);

    const headers: Record<string, string> = { Accept: 'application/json', 'X-Api-Key': apiKey };
    if (opts.sigatId != null) headers['X-Contribuyente-Id'] = String(opts.sigatId);

    const timeoutMs = timeoutOverrideMs ?? this.config.get<number>('sigat.timeoutMs') ?? 15000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: 'GET', headers, signal: controller.signal });
      const cuerpo = (await res.json().catch(() => null)) as unknown;

      if (!res.ok) {
        const err = cuerpo as SigatRawError | null;
        const mensaje = err?.mensaje ?? `SIGAT respondió HTTP ${res.status}`;
        throw new SigatError(mensaje, err?.codigo ?? res.status);
      }
      return cuerpo as T;
    } catch (e) {
      if (e instanceof SigatError) throw e;
      this.logger.error(`Fallo al contactar SIGAT (${ruta})`, e as Error);
      throw new SigatError('No se pudo contactar a SIGAT');
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Mapeo crudo → dominio ─────────────────────────────────────────────────

  private mapContribuyente(r: SigatRawContribuyente | null): SigatContribuyente {
    if (!r) throw new SigatError('SIGAT devolvió una respuesta vacía');
    return {
      id: r.id,
      rif: r.rif,
      razonSocial: r.razonSocial,
      domicilioFiscal: r.domicilioFiscal ?? null,
      verificado: r.verificado ?? false,
      alcaldias: (r.alcaldias ?? []).map((a) => ({ id: a.id, nombre: a.nombre })),
    };
  }

  private mapConsolidado(r: SigatRawConsolidadoItem): SigatConsolidadoAlcaldia {
    const info = r.informacionBancaria;
    const t = info?.transferencias;
    return {
      alcaldia: {
        id: info?.alcaldia?.id ?? 0,
        nombre: info?.alcaldia?.nombre ?? '',
        siglas: info?.alcaldia?.siglas ?? null,
        activa: info?.alcaldia?.activa ?? false,
      },
      metodosPago: resolverCatalogo(METODOS_PAGO, info?.metodosPago),
      transferencias: t
        ? {
            rif: t.rif ?? '',
            beneficiario: t.beneficiario ?? '',
            instrucciones: t.instrucciones ?? '',
          }
        : null,
    };
  }

  private mapObligaciones(r: SigatRawObligaciones | null): SigatObligaciones {
    if (!r) throw new SigatError('SIGAT devolvió una respuesta vacía');
    return {
      habilitadas: resolverCatalogo(ACTIVIDADES_ECONOMICAS, r.habilitadas),
      versiones: r.versiones ?? [],
      licencias: (r.licencias ?? []).map((l) => ({
        id: l.id,
        numero: l.numero,
        tipo: l.tipo ?? null,
        fechaEmision: l.fechaEmision ?? null,
        fechaVigenciaHasta: l.fechaVigenciaHasta ?? null,
        codigoCatastral: l.codigoCatastral ?? null,
      })),
    };
  }

  private mapLicenciaActiva(r: SigatRawLicenciaActivaItem): SigatLicenciaActiva {
    const l = r.licencia;
    return {
      id: l?.id ?? 0,
      numero: l?.numero ?? '',
      alcaldiaId: l?.alcaldia?.id ?? null,
      fechaVigenciaDesde: l?.fechaVigenciaDesde ?? null,
      fechaVigenciaHasta: l?.fechaVigenciaHasta ?? null,
      areaEstablecimiento: this.numeroOnull(l?.areaEstablecimiento),
      horarioEstablecimiento: l?.horarioEstablecimiento ?? null,
    };
  }

  private mapLicenciaDetalle(r: SigatRawLicenciaDetalle | null): SigatLicenciaDetalle {
    const l = r?.licencia;
    if (!l) throw new SigatError('SIGAT devolvió una licencia vacía');
    return {
      id: l.id,
      numero: l.numero,
      tipo: l.tipo ?? null,
      codigoCatastral: l.codigoCatastral ?? null,
      fechaEmision: l.fechaEmision ?? null,
      fechaRenovacion: l.fechaRenovacion ?? null,
      fechaVigenciaDesde: l.fechaVigenciaDesde ?? null,
      fechaVigenciaHasta: l.fechaVigenciaHasta ?? null,
      areaEstablecimiento: this.numeroOnull(l.areaEstablecimiento),
      horarioEstablecimiento: l.horarioEstablecimiento ?? null,
      telefonoEstablecimiento: l.telefonoEstablecimiento ?? null,
      direccion: l.direccion ?? null,
      cantidadEmpleados: l.cantidadEmpleados ?? null,
      alcaldia: l.alcaldia
        ? { id: l.alcaldia.id, nombre: l.alcaldia.nombre, siglas: l.alcaldia.siglas ?? null }
        : null,
      vencida: l.vencida ?? null,
      renovable: l.renovable ?? null,
      urlDocumento: r?.urlDocumento ?? null,
    };
  }

  private numeroOnull(v: number | string | null | undefined): number | null {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  private mapVehiculo(r: SigatRawVehiculo | null): SigatVehiculo {
    if (!r) throw new SigatError('SIGAT devolvió una respuesta vacía');
    return {
      id: r.id,
      contribuyente: r.contribuyente ?? null,
      alcaldia: r.alcaldia ?? null,
      tipo: r.tipo ?? null,
      marca: r.marca ?? null,
      modelo: r.modelo ?? null,
      ano: r.ano ?? null,
      placa: r.placa ?? null,
    };
  }
}
