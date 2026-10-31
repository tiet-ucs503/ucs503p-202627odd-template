import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

function loadFirstNonEmptyEnv(paths: string[]): void {
  for (const path of paths) {
    if (!existsSync(path) || statSync(path).size === 0) {
      continue;
    }
    loadEnv({ path, override: true });
    return;
  }
}

loadFirstNonEmptyEnv([
  resolve(import.meta.dirname, '.env'),
  resolve(process.env.LOCALAPPDATA ?? '', 'AgriConnect', 'backend.env'),
]);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // process.env (not env()) so `prisma generate` still works if URL is only needed later
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
});
