import { BadRequestException } from '@nestjs/common';
import { Prisma, TipoRetencion } from '@prisma/client';
import { RetencionesService } from './retenciones.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { NumeracionService } from '../puntos-emision/numeracion.service';
import { ImprentaService } from '../imprenta/imprenta.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { EmitirRetencionDto } from './dto/emitir-retencion.dto';

describe('RetencionesService.emitir', () => {
  const ACTOR = { id: 'user-1', contribuyenteId: 'contrib-1' } as AuthenticatedUser;
  const DTO: EmitirRetencionDto = { compraId: 'compra-1', puntoEmisionId: 'punto-1' };

  // La compra referencia una factura de un mes distinto al "ahora" simulado,
  // para poder distinguir "mes de la factura" de "mes de emisión" en el assert.
  const COMPRA = {
    id: 'compra-1',
    contribuyenteId: 'contrib-1',
    numeroControl: 'NC-1',
    numeroFactura: 'F-1',
    fecha: new Date('2026-01-15T00:00:00Z'),
    total: new Prisma.Decimal(116),
    ivaCredito: new Prisma.Decimal(16),
    base: new Prisma.Decimal(100),
    proveedorTerceroId: 'prov-1',
    proveedor: { rif: 'J123456789', nombre: 'Proveedor SA', direccion: null, email: null },
  };

  function crearServicio(txCreate: jest.Mock) {
    const prisma = {
      contribuyente: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'contrib-1',
          rif: 'J987654321',
          razonSocial: 'Mi Comercio',
          domicilioFiscal: null,
          agenteRetencion: true,
        }),
      },
      compra: { findFirst: jest.fn().mockResolvedValue(COMPRA) },
      comprobanteRetencion: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      puntoEmision: { findFirst: jest.fn().mockResolvedValue({ id: 'punto-1' }) },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
        cb({ comprobanteRetencion: { create: txCreate } }),
      ),
    } as unknown as PrismaService;
    const numeracion = {
      siguiente: jest.fn().mockResolvedValue({ numero: 1, docNum: '00000001' }),
    } as unknown as NumeracionService;
    const imprenta = {
      generarRetencionIva: jest.fn().mockResolvedValue({ numeroControl: 'NC-999' }),
      generarRetencionIslr: jest.fn().mockResolvedValue({ numeroControl: 'NC-999' }),
    } as unknown as ImprentaService;
    const auditoria = { registrar: jest.fn() } as unknown as AuditoriaService;
    const service = new RetencionesService(prisma, numeracion, imprenta, auditoria);
    return { service, prisma };
  }

  it('fija periodoYear/periodoMonth al mes de EMISIÓN, no al mes de la factura referenciada', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-11T12:00:00Z'));
    const txCreate = jest.fn().mockImplementation((args) =>
      Promise.resolve({ id: 'ret-1', ...args.data }),
    );
    const { service, prisma } = crearServicio(txCreate);
    (prisma.comprobanteRetencion.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      id: 'ret-1',
      docNum: '20260700000001',
      periodoYear: '2026',
      periodoMonth: '07',
      fecha: new Date(),
      hora: '12:00:00',
      facDocumentNum: 'F-1',
      facControlNum: 'NC-1',
      base: '16.00',
      porcentaje: '75.00',
      montoRetenido: '12.00',
      sustraendo: '0.00',
      conceptoIslr: null,
      tipo: TipoRetencion.IVA,
    });

    try {
      await service.emitirIva(DTO, ACTOR);
    } finally {
      jest.useRealTimers();
    }

    expect(txCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ periodoYear: '2026', periodoMonth: '07' }),
      }),
    );
    // La factura referenciada es de enero — si el bug reapareciera, periodoMonth sería '01'.
    expect(txCreate.mock.calls[0][0].data.periodoMonth).not.toBe('01');
  });

  it('convierte una violación de constraint única (P2002, carrera concurrente) en BadRequestException', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
    });
    const { service } = crearServicio(jest.fn());
    // Forzamos que la transacción completa rechace con P2002 (simula que otra
    // request concurrente ya insertó la fila entre el check findFirst y el create).
    const prisma = (service as unknown as { prisma: PrismaService }).prisma;
    (prisma.$transaction as jest.Mock).mockRejectedValueOnce(p2002);

    await expect(service.emitirIva(DTO, ACTOR)).rejects.toBeInstanceOf(BadRequestException);
  });
});
