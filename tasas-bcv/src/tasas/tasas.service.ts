import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface TasaDiariaDto {
  id: string;
  cur_cod: string;
  valid_from: string;
  rat_exc: string;
  created_at: string;
}

export interface TasasDiaResponseDto {
  fecha: string;
  EUR: TasaDiariaDto | null;
  USD: TasaDiariaDto | null;
}

interface TasaDiariaRow {
  cur_cod: string;
  valid_from: string | Date;
  rat_exc: string;
  created_at: string | Date;
}

@Injectable()
export class TasasService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getUltimas(): Promise<TasasDiaResponseDto> {
    const maxRows = await this.dataSource.query(
      'SELECT MAX(valid_from) AS fecha FROM tasa_cache',
    );
    const fecha = this.toIsoDate(maxRows[0]?.fecha);

    if (!fecha) {
      throw new NotFoundException({
        error: 'sin_datos',
        mensaje: 'No hay registros en tasa_cache.',
      });
    }

    return this.getPorFecha(fecha);
  }

  async getPorFecha(fecha: string): Promise<TasasDiaResponseDto> {
    const rows = (await this.dataSource.query(
      `
        SELECT cur_cod, valid_from, rat_exc, created_at
        FROM tasa_cache
        WHERE valid_from = $1::date AND cur_cod IN ('EUR', 'USD')
        ORDER BY cur_cod
      `,
      [fecha],
    )) as TasaDiariaRow[];

    if (rows.length === 0) {
      throw new NotFoundException({
        error: 'no_encontrado',
        mensaje: `No hay tasas EUR/USD para la fecha ${fecha}.`,
        fecha,
      });
    }

    const byCode = Object.fromEntries(
      rows.map((row) => [row.cur_cod, this.rowToDto(row)]),
    ) as Record<string, TasaDiariaDto>;

    return {
      fecha,
      EUR: byCode.EUR ?? null,
      USD: byCode.USD ?? null,
    };
  }

  private rowToDto(row: TasaDiariaRow): TasaDiariaDto {
    const validFrom = this.toIsoDate(row.valid_from) ?? '';
    return {
      // tasa_cache no tiene columna id (PK compuesta); se sintetiza para el contrato.
      id: `${row.cur_cod}_${validFrom}`,
      cur_cod: row.cur_cod,
      valid_from: validFrom,
      rat_exc: String(row.rat_exc),
      created_at:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
    };
  }

  private toIsoDate(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
  }
}
