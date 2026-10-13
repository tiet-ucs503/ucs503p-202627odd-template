import path from "node:path";
import type { Config } from "drizzle-kit";

const url = process.env.DATABASE_URL;
const isPostgres =
  !!url && (url.startsWith("postgres://") || url.startsWith("postgresql://"));

const sqliteFile = process.env.SQLITE_PATH ?? path.join(process.cwd(), "solpop.db");

const config: Config = isPostgres
  ? {
      schema: "./lib/db/schema.ts",
      out: "./drizzle",
      dialect: "postgresql",
      dbCredentials: { url: url! },
      casing: "snake_case",
    }
  : {
      schema: "./lib/db/schema.ts",
      out: "./drizzle",
      dialect: "sqlite",
      dbCredentials: { url: sqliteFile },
      casing: "snake_case",
    };

export default config;
