/**
 * Configuración centralizada de la aplicación.
 * Lee las variables de entorno y las expone tipadas vía ConfigService.
 */
export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },

  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'us-east-1',
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    bucket: process.env.S3_BUCKET ?? 'facturador',
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },

  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3001')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  // Login biométrico (WebAuthn/passkeys). rpId es el hostname (sin protocolo/puerto)
  // que sirve el frontend: DEBE ser estable, ya que una passkey queda atada a él.
  // El túnel Cloudflare rota de hostname en cada reinicio, así que no sirve como
  // rpId — las passkeys solo son utilizables en localhost hasta tener un dominio fijo.
  webauthn: {
    rpId: process.env.WEBAUTHN_RP_ID ?? 'localhost',
    rpName: process.env.WEBAUTHN_RP_NAME ?? 'Fiskaria',
    origin: (process.env.WEBAUTHN_ORIGIN ?? 'http://localhost:3001')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },

  // Rate limiting (configurable por entorno).
  throttle: {
    ttlMs: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  },

  // Validador de contribuyentes del SENIAT (RN-101).
  seniat: {
    validadorUrl:
      process.env.SENIAT_VALIDADOR_URL ??
      'https://appmovil.seniat.gob.ve/api/validador-contribuyente',
    timeoutMs: parseInt(process.env.SENIAT_TIMEOUT_MS ?? '8000', 10),
    // En dev evitamos golpear la API real del gobierno.
    mock: (process.env.SENIAT_MOCK ?? 'true').toLowerCase() === 'true',
  },

  // Imprenta Digital — Sirumatek (RN-007). Auth por header API-T-Token: <id>|<secret>.
  imprenta: {
    baseUrl: process.env.IMPRENTA_BASE_URL ?? '',
    apiToken: process.env.IMPRENTA_API_TOKEN ?? '',
    timeoutMs: parseInt(process.env.IMPRENTA_TIMEOUT_MS ?? '10000', 10),
    // Mientras el adaptador no esté al contrato real, se simula el número de control.
    mock: (process.env.IMPRENTA_MOCK ?? 'true').toLowerCase() === 'true',
  },

  // Microservicio externo de tasas BCV (USD/EUR). Repo aparte; el backend solo consume.
  tasasBcv: {
    baseUrl: process.env.TASAS_BCV_URL ?? 'http://localhost:3005',
    timeoutMs: parseInt(process.env.TASAS_BCV_TIMEOUT_MS ?? '6000', 10),
    mock: (process.env.TASAS_BCV_MOCK ?? 'true').toLowerCase() === 'true',
  },

  // Open Food Facts (catálogo de productos, lectura pública). El User-Agent es
  // obligatorio por sus términos de uso — sin él pueden bloquear la IP.
  openFoodFacts: {
    baseUrl: process.env.OFF_BASE_URL ?? 'https://world.openfoodfacts.org',
    userAgent: process.env.OFF_USER_AGENT ?? 'Fiskaria/1.0 (soporte@fiskaria.app)',
    timeoutMs: parseInt(process.env.OFF_TIMEOUT_MS ?? '6000', 10),
  },
});
