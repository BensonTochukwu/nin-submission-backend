type EnvConfig = Record<string, unknown>;

const defaults: Record<string, string> = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/nysc_forms',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  JWT_SECRET: 'change_me',
  JWT_EXPIRES_IN: '1d',
  PORT: '3000',
  APP_URL: 'http://localhost:3000',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'nysc-forms',
  S3_ACCESS_KEY_ID: 'minioadmin',
  S3_SECRET_ACCESS_KEY: 'minioadmin',
  S3_FORCE_PATH_STYLE: 'true',
  SIGNED_URL_EXPIRES_IN: '300',
  UPLOAD_TMP_DIR: 'tmp/uploads',
  THROTTLE_TTL: '60000',
  THROTTLE_LIMIT: '100',
  PUBLIC_SUBMISSION_RATE_LIMIT: '10',
  PUBLIC_SUBMISSION_RATE_TTL: '60000',
};

const required = [
  'DATABASE_URL',
  'REDIS_HOST',
  'REDIS_PORT',
  'JWT_SECRET',
  'PORT',
  'APP_URL',
  'S3_REGION',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'SIGNED_URL_EXPIRES_IN',
  'UPLOAD_TMP_DIR',
  'THROTTLE_TTL',
  'THROTTLE_LIMIT',
  'PUBLIC_SUBMISSION_RATE_LIMIT',
  'PUBLIC_SUBMISSION_RATE_TTL',
];

const positiveIntegers = [
  'REDIS_PORT',
  'PORT',
  'SIGNED_URL_EXPIRES_IN',
  'THROTTLE_TTL',
  'THROTTLE_LIMIT',
  'PUBLIC_SUBMISSION_RATE_LIMIT',
  'PUBLIC_SUBMISSION_RATE_TTL',
];

export function validateEnv(config: EnvConfig) {
  const env = { ...defaults, ...config } as Record<string, string>;
  const missing = required.filter((key) => !String(env[key] ?? '').trim());

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  for (const key of positiveIntegers) {
    const value = Number(env[key]);
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`${key} must be a positive integer`);
    }
    env[key] = String(value);
  }

  if (!['true', 'false'].includes(String(env.S3_FORCE_PATH_STYLE).toLowerCase())) {
    throw new Error('S3_FORCE_PATH_STYLE must be true or false');
  }
  env.S3_FORCE_PATH_STYLE = String(env.S3_FORCE_PATH_STYLE).toLowerCase();

  for (const [key, value] of Object.entries(env)) {
    process.env[key] = String(value);
  }

  return env;
}
