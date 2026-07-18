import { Logger } from '@nestjs/common';
import { ContabilidadService } from './contabilidad.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

describe('ContabilidadService.registrarAutomatico', () => {
  const CONTRIBUYENTE_ID = 'contrib-1';
  const CUENTA_POR_EVENTO: Record<string, string> = {
    caja_efectivo: 'cuenta-caja',
    venta_ingreso: 'cuenta-ingreso',
  };

  function crearServicio(overrides?: { asientoCreate?: jest.Mock }) {
    const prisma = {
      configCuentaContable: {
        findMany: jest.fn(({ where }: { where: { evento: { in: string[] } } }) =>
          Promise.resolve(
            where.evento.in
              .filter((evento) => evento in CUENTA_POR_EVENTO)
              .map((evento) => ({ evento, cuentaId: CUENTA_POR_EVENTO[evento] })),
          ),
        ),
      },
      asiento: { create: overrides?.asientoCreate ?? jest.fn((args) => Promise.resolve({ id: 'asiento-1', ...args.data })) },
    } as unknown as PrismaService;
    const service = new ContabilidadService(prisma, {} as AuditoriaService);
    return { service, prisma };
  }

  it('persiste el asiento cuando debe y haber cuadran', async () => {
    const { service, prisma } = crearServicio();
    const resultado = await service.registrarAutomatico({
      contribuyenteId: CONTRIBUYENTE_ID,
      fecha: new Date('2026-01-01'),
      glosa: 'Venta test',
      lineas: [
        { evento: 'caja_efectivo', debe: 100 },
        { evento: 'venta_ingreso', haber: 100 },
      ],
    });
    expect(resultado).not.toBeNull();
    expect(prisma.asiento.create).toHaveBeenCalledTimes(1);
  });

  it('descarta el asiento y NO lanza cuando debe y haber no cuadran (bug del caller)', async () => {
    const { service, prisma } = crearServicio();
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const resultado = await service.registrarAutomatico({
      contribuyenteId: CONTRIBUYENTE_ID,
      fecha: new Date('2026-01-01'),
      glosa: 'Venta descuadrada',
      lineas: [
        { evento: 'caja_efectivo', debe: 103 }, // descuadre de 3 (ej. IGTF duplicado)
        { evento: 'venta_ingreso', haber: 100 },
      ],
    });
    expect(resultado).toBeNull();
    expect(prisma.asiento.create).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('no cuadra'));
    errorSpy.mockRestore();
  });

  it('descarta el asiento (warn, no error) cuando falta configurar una cuenta — degradación esperada (RN-135)', async () => {
    const { service, prisma } = crearServicio();
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const resultado = await service.registrarAutomatico({
      contribuyenteId: CONTRIBUYENTE_ID,
      fecha: new Date('2026-01-01'),
      glosa: 'Venta sin cuenta IGTF',
      lineas: [
        { evento: 'caja_efectivo', debe: 100 },
        { evento: 'igtf', haber: 100 }, // 'igtf' no está en CUENTA_POR_EVENTO
      ],
    });
    expect(resultado).toBeNull();
    expect(prisma.asiento.create).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('sin cuenta configurada'));
    warnSpy.mockRestore();
  });
});
