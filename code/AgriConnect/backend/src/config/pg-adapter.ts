import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

function isLocalPostgres(connectionString: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(connectionString);
}

function relaxSslMode(connectionString: string): string {
  if (/sslmode=/i.test(connectionString)) {
    return connectionString.replace(/sslmode=[^&]*/i, 'sslmode=no-verify');
  }
  return connectionString.includes('?')
    ? `${connectionString}&sslmode=no-verify`
    : `${connectionString}?sslmode=no-verify`;
}

export function createPrismaAdapter(connectionString: string): PrismaPg {
  const local = isLocalPostgres(connectionString);
  const url =
    local || process.env.NODE_ENV === 'production'
      ? connectionString
      : relaxSslMode(connectionString);

  const pool = new Pool({
    connectionString: url,
    max: 10,
    ssl: local ? false : { rejectUnauthorized: false },
  });

  return new PrismaPg(pool);
}
