import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { parse } from 'csv-parse/sync';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DataSource } from 'typeorm';

const MESES: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

interface ImportRow {
  curCod: string;
  validFrom: string;
  ratExc: number;
}

@Injectable()
export class CsvImportService {
  constructor(
    private readonly config: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async importCsv(): Promise<number> {
    const csvPath = this.config.get<string>('CSV_PATH')
      ? path.resolve(this.config.getOrThrow<string>('CSV_PATH'))
      : path.resolve(process.cwd(), 'Listado de Tasas Diarias.csv');

    if (!fs.existsSync(csvPath)) {
      throw new Error(`No existe el CSV: ${csvPath}`);
    }

    const rows = this.sortRowsForMonotonicIds(this.readRows(csvPath));
    const insertSql = `
      INSERT INTO tasa_cache (cur_cod, valid_from, rat_exc)
      VALUES ($1, $2::date, $3)
      ON CONFLICT (cur_cod, valid_from) DO UPDATE
      SET rat_exc = EXCLUDED.rat_exc;
    `;

    for (const row of rows) {
      await this.dataSource.query(insertSql, [
        row.curCod,
        row.validFrom,
        row.ratExc,
      ]);
    }

    return rows.length;
  }

  private readRows(csvPath: string): ImportRow[] {
    const text = fs.readFileSync(csvPath, 'utf8');
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Array<Record<string, unknown>>;

    return records.map((row) => {
      const curCod = row['Cur Cod'] ?? row.cur_cod;
      const validFromRaw = row['Valid From'] ?? row.valid_from;
      const ratRaw = row['Rat Exc'] ?? row.rat_exc;

      if (!curCod || validFromRaw == null || ratRaw == null) {
        throw new Error(`Fila inválida: ${JSON.stringify(row)}`);
      }

      const validFrom = this.parseValidFromToIsoDate(String(validFromRaw));
      const ratExc = Number(String(ratRaw).replace(',', '.'));

      if (!Number.isFinite(ratExc)) {
        throw new Error(`Tasa no numérica: ${JSON.stringify(row)}`);
      }

      return {
        curCod: String(curCod).trim().toUpperCase(),
        validFrom,
        ratExc,
      };
    });
  }

  private parseValidFromToIsoDate(raw: string): string {
    const inner = raw.replace(/^"|"$/g, '');
    const s = inner
      .replace(/\u202f|\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const re =
      /^(\w+)\s+(\d+),\s*(\d+),\s*\d+:\d+\s*(a\.?\s*m\.?|p\.?\s*m\.?)$/i;
    const match = s.match(re);

    if (!match) {
      throw new Error(`Fecha no reconocida: ${JSON.stringify(raw)}`);
    }

    const [, mesNombre, dia, anio] = match;
    const mesIdx = MESES[mesNombre.toLowerCase()];

    if (mesIdx === undefined) {
      throw new Error(`Mes no reconocido en: ${JSON.stringify(raw)}`);
    }

    const mm = String(mesIdx + 1).padStart(2, '0');
    const dd = String(Number(dia)).padStart(2, '0');

    return `${anio}-${mm}-${dd}`;
  }

  private sortRowsForMonotonicIds(rows: ImportRow[]): ImportRow[] {
    return [...rows].sort((a, b) => {
      const byDate = a.validFrom.localeCompare(b.validFrom);
      if (byDate !== 0) return byDate;
      return a.curCod.localeCompare(b.curCod);
    });
  }
}
