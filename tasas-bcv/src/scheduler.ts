import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BcvSyncService } from './bcv/bcv-sync.service';

function parseHours(raw: string | undefined): number[] {
  const value = raw || '8,14,20';
  const hours = value
    .split(',')
    .map((h) => Number(h.trim()))
    .filter((h) => Number.isInteger(h) && h >= 0 && h <= 23);

  if (hours.length === 0) {
    throw new Error('BCV_SYNC_HOURS no contiene horas válidas (0-23).');
  }

  return [...new Set(hours)].sort((a, b) => a - b);
}

function nextRunDate(hours: number[], now = new Date()): Date {
  for (const hour of hours) {
    const candidate = new Date(now);
    candidate.setHours(hour, 0, 0, 0);
    if (candidate.getTime() > now.getTime()) {
      return candidate;
    }
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(hours[0], 0, 0, 0);
  return tomorrow;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const bcvSync = app.get(BcvSyncService);
  const hours = parseHours(process.env.BCV_SYNC_HOURS);

  let timer: NodeJS.Timeout | undefined;
  let running = false;

  const runSync = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const result = await bcvSync.sync();
      console.log(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[bcv-scheduler] Error: ${message}`);
    } finally {
      running = false;
    }
  };

  const scheduleNext = (): void => {
    const next = nextRunDate(hours);
    const delay = next.getTime() - Date.now();
    console.log(`[bcv-scheduler] Próxima ejecución: ${next.toISOString()}`);
    timer = setTimeout(() => {
      void runSync().finally(scheduleNext);
    }, delay);
  };

  const shutdown = async (): Promise<void> => {
    if (timer) clearTimeout(timer);
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  if (process.env.BCV_SYNC_RUN_ON_START === '1') {
    await runSync();
  }

  scheduleNext();
}

void bootstrap();
