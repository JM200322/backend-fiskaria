import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { TasaDiaria } from '../tasas/tasa-diaria.entity';
import { CreateTasasDiarias1715720000000 } from './migrations/1715720000000-CreateTasasDiarias';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Falta DATABASE_URL en .env');
}

const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities: [TasaDiaria],
  migrations: [CreateTasasDiarias1715720000000],
  synchronize: false,
  migrationsRun: false,
});

export default AppDataSource;
