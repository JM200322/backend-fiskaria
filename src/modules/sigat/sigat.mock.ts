/**
 * Datos de ejemplo para el modo mock (dev). Reproducen las respuestas reales del
 * staging de SIGAT (contribuyente de prueba FARMATODO, C.A. — RIF J000202001)
 * para que el frontend se desarrolle sin depender de la API externa.
 */
import {
  SigatRawConsolidadoItem,
  SigatRawContribuyente,
  SigatRawLicenciaActivaItem,
  SigatRawLicenciaDetalle,
  SigatRawObligaciones,
  SigatRawVehiculo,
  SigatDocumento,
  SigatTipoVehiculo,
} from './sigat.types';

export function contribuyente(rif: string): SigatRawContribuyente {
  return {
    id: 1583,
    rif,
    razonSocial: 'FARMATODO, C.A.',
    domicilioFiscal: 'AV LOS GUAYABITOS CC EXPRESO BARUTA',
    verificado: true,
    usuario: { id: 1583, correo: 'j000202001@sirumatst.com', telefono: '04121234567' },
    alcaldias: [
      { id: 1, nombre: 'Alcaldía de Caracas' },
      { id: 273, nombre: 'Alcaldía de Juan Antonio Sotillo' },
    ],
  };
}

export function consolidado(): SigatRawConsolidadoItem[] {
  return [
    {
      informacionBancaria: {
        alcaldia: { id: 1, nombre: 'Alcaldía de Caracas', siglas: 'SUMAR Caracas', activa: true },
        metodosPago: [1, 2, 3, 4, 11],
        transferencias: {
          rif: 'G200002123',
          beneficiario: 'ALCALDÍA DEL MUNICIPIO LIBERTADOR',
          instrucciones: 'Puede realizar sus transferencias bancarias a los números de cuenta indicados.',
        },
      },
    },
  ];
}

export function obligaciones(): SigatRawObligaciones {
  return {
    habilitadas: [1, 2, 3, 4, 5, 7, 9, 10, 12, 19],
    versiones: [{ '4': 2 }],
    licencias: [
      {
        id: 11459,
        numero: 'LU-2022-017029',
        tipo: 1,
        fechaEmision: '2022-01-10',
        fechaVigenciaHasta: '2028-05-13',
        codigoCatastral: '01-01-08-U01-015-016-001-000-0PB-011',
      },
    ],
  };
}

export function licenciasActivas(): SigatRawLicenciaActivaItem[] {
  return [
    {
      licencia: {
        id: 11459,
        numero: 'LU-2022-017029',
        alcaldia: { id: 1 },
        fechaVigenciaDesde: '2025-05-13',
        fechaVigenciaHasta: '2028-05-13',
        areaEstablecimiento: 472.0,
        horarioEstablecimiento: 'LUNES A DOMINGO DE 8:00 AM A 9:00 PM',
      },
    },
  ];
}

export function licenciaDetalle(id: number): SigatRawLicenciaDetalle {
  return {
    licencia: {
      id,
      numero: 'LU-2022-017029',
      tipo: 1,
      codigoCatastral: '01-01-08-U01-015-016-001-000-0PB-011',
      fechaEmision: '2022-01-10',
      fechaRenovacion: '2025-04-24',
      fechaVigenciaDesde: '2025-05-13',
      fechaVigenciaHasta: '2028-05-13',
      areaEstablecimiento: 472,
      horarioEstablecimiento: 'LUNES A DOMINGO DE 8:00 AM A 9:00 PM',
      direccion: 'AV LOS GUAYABITOS CC EXPRESO BARUTA',
      cantidadEmpleados: 120,
      alcaldia: { id: 1, nombre: 'Alcaldía de Caracas', siglas: 'SUMAR Caracas' },
      vencida: false,
      renovable: true,
    },
    urlDocumento: 'https://stage.sigat.net/api/v1/licencias/17b8269c-a9c7-4bba-a08a-96595e1e0776',
  };
}

export function tiposVehiculo(): SigatTipoVehiculo[] {
  return [
    { id: 45, categoria: 5, descripcion: 'Automóviles de Colección' },
    { id: 41, categoria: 4, descripcion: 'Motocicletas' },
    { id: 49, categoria: 1, descripcion: 'Transporte de Carga Pesada' },
  ];
}

export function vehiculo(id: number): SigatRawVehiculo {
  return {
    id,
    contribuyente: { id: 1583, rif: 'J000202001', razonSocial: 'FARMATODO, C.A.' },
    alcaldia: { id: 10, nombre: 'Alcaldia Municipio Cristobal Rojas Charallave' },
    tipo: { id: 58, categoria: 5, descripcion: 'Transporte de Carga Pesada' },
    marca: 'IVECO',
    modelo: '170E22 GATO HIDRAULICO',
    ano: 2007,
    placa: 'A00AT2D',
  };
}

export function documentos(): SigatDocumento[] {
  return [
    {
      campo: 'id_documento_identificacion',
      url: 'https://stage.sigat.net/api/v1/contribuyente/documentos/919109/descargaExt',
    },
    {
      campo: 'id_documento_rif',
      url: 'https://stage.sigat.net/api/v1/contribuyente/documentos/1511601/descargaExt',
    },
  ];
}
