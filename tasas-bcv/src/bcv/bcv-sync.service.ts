import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import * as cheerio from 'cheerio';
import * as https from 'node:https';
import { URL } from 'node:url';
import { DataSource } from 'typeorm';

const DEFAULT_BCV_URL = 'https://www.bcv.org.ve/';

interface BcvRates {
  valorDate: string;
  eur: number;
  usd: number;
}

@Injectable()
export class BcvSyncService {
  constructor(
    private readonly config: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async sync(): Promise<string> {
    const pageUrl = this.config.get<string>('BCV_PAGE_URL') || DEFAULT_BCV_URL;
    const html = await this.httpsGetFull(pageUrl);
    const { valorDate, eur, usd } = this.parseBcvHome(html);

    const [eurRows, usdRows] = await Promise.all([
      this.dataSource.query(
        `
          SELECT 1
          FROM tasa_cache
          WHERE valid_from = $1::date AND cur_cod = 'EUR'
          LIMIT 1
        `,
        [valorDate],
      ),
      this.dataSource.query(
        `
          SELECT 1
          FROM tasa_cache
          WHERE valid_from = $1::date AND cur_cod = 'USD'
          LIMIT 1
        `,
        [valorDate],
      ),
    ]);

    if (eurRows.length > 0 && usdRows.length > 0) {
      return `[bcv] Sin cambios: ya existen EUR y USD para la fecha de valor ${valorDate}. No se reescribe.`;
    }

    const insertSql = `
      INSERT INTO tasa_cache (cur_cod, valid_from, rat_exc)
      VALUES ($1, $2::date, $3)
      ON CONFLICT (cur_cod, valid_from) DO UPDATE
      SET rat_exc = EXCLUDED.rat_exc;
    `;

    await this.dataSource.query(insertSql, ['EUR', valorDate, eur]);
    await this.dataSource.query(insertSql, ['USD', valorDate, usd]);

    return `[bcv] Guardado EUR=${eur} USD=${usd} valid_from=${valorDate} (origen: ${pageUrl})`;
  }

  private parseBcvHome(html: string): BcvRates {
    const $ = cheerio.load(html);
    const $block = $('.view-id-tipo_de_cambio_oficial_del_bcv').first();

    if (!$block.length) {
      throw new Error(
        'No se encontró el bloque ".view-id-tipo_de_cambio_oficial_del_bcv" en el HTML',
      );
    }

    const content = $block.find('span.date-display-single').attr('content');
    if (!content) {
      throw new Error(
        'No se encontró span.date-display-single con atributo "content"',
      );
    }

    const dateMatch = content.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) {
      throw new Error(`Fecha en "content" no reconocida: ${content}`);
    }

    return {
      valorDate: dateMatch[1],
      eur: this.parseEuropeanRate(
        $block.find('#euro strong.strong-tb').first().text(),
      ),
      usd: this.parseEuropeanRate(
        $block.find('#dolar strong.strong-tb').first().text(),
      ),
    };
  }

  private parseEuropeanRate(text: string): number {
    const normalized = text.trim().replace(/\s+/g, '');
    if (!normalized) throw new Error('Tasa vacía');

    const value = Number(normalized.replace(',', '.'));
    if (!Number.isFinite(value)) {
      throw new Error(`Tasa no numérica: ${JSON.stringify(text)}`);
    }

    return value;
  }

  private httpsGetFull(urlString: string): Promise<string> {
    const insecure = this.config.get<string>('BCV_INSECURE_TLS') === '1';
    const maxRedirects = 8;

    return new Promise((resolve, reject) => {
      const doReq = (urlStr: string, redirectsLeft: number): void => {
        const url = new URL(urlStr);
        const req = https.request(
          {
            protocol: url.protocol,
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname + url.search,
            method: 'GET',
            headers: {
              Accept: 'text/html,*/*',
              'User-Agent':
                'Mozilla/5.0 (compatible; TasasBCV-nest/1.0; Node.js; uso interno)',
            },
            rejectUnauthorized: !insecure,
          },
          (res) => {
            const location = res.headers.location;
            if (
              res.statusCode &&
              res.statusCode >= 300 &&
              res.statusCode < 400 &&
              location &&
              redirectsLeft > 0
            ) {
              const next = new URL(location, urlStr).href;
              res.resume();
              doReq(next, redirectsLeft - 1);
              return;
            }

            if (res.statusCode !== 200) {
              res.resume();
              reject(new Error(`HTTP ${res.statusCode} en ${urlStr}`));
              return;
            }

            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            res.on('end', () =>
              resolve(Buffer.concat(chunks).toString('utf8')),
            );
          },
        );

        req.on('error', reject);
        req.setTimeout(25_000, () => {
          req.destroy(new Error('Timeout al descargar la página del BCV'));
        });
        req.end();
      };

      doReq(urlString, maxRedirects);
    });
  }
}
