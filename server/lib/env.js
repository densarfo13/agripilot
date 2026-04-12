function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 5000),
  DATABASE_URL: required('DATABASE_URL'),
  ACCESS_TOKEN_SECRET: required('ACCESS_TOKEN_SECRET', process.env.JWT_SECRET || 'dev-access-secret-replace-me'),
  REFRESH_TOKEN_SECRET: required('REFRESH_TOKEN_SECRET', process.env.JWT_SECRET ? process.env.JWT_SECRET + '-refresh' : 'dev-refresh-secret-replace-me'),
  APP_BASE_URL: required('APP_BASE_URL', 'http://localhost:5173'),
  API_BASE_URL: required('API_BASE_URL', 'http://localhost:5000'),
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: Number(process.env.SMTP_PORT || 587),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || 'no-reply@example.com',
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || '',
  ALLOWED_ORIGINS: (process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
};
