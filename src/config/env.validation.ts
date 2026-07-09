import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, MinLength, validateSync } from 'class-validator';

/**
 * Validación de variables de entorno al arranque.
 * Si falta una variable obligatoria o tiene tipo incorrecto, la app no inicia.
 */
enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  DATABASE_URL: string;

  // Mínimo 32 caracteres para que un secreto débil no pase la validación de arranque.
  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string;

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(
      `Error en variables de entorno:\n${errors
        .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
        .join('\n')}`,
    );
  }
  return validatedConfig;
}
