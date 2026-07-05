import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BcvSyncService } from './bcv/bcv-sync.service';
import { CsvImportService } from './import/csv-import.service';

async function main(): Promise<void> {
  const command = process.argv[2];
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    if (command === 'import:csv') {
      const count = await app.get(CsvImportService).importCsv();
      console.log(`Importadas ${count} filas desde CSV.`);
      return;
    }

    if (command === 'bcv:sync') {
      const result = await app.get(BcvSyncService).sync();
      console.log(result);
      return;
    }

    console.error(
      'Comando no reconocido. Use: import:csv | bcv:sync',
    );
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
