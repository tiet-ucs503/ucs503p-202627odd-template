import { Sequelize } from "sequelize";
import { env } from "./env";

// Plain MySQL connection via Sequelize + mysql2 — no Prisma involved.
export const sequelize = new Sequelize(env.dbName, env.dbUser, env.dbPassword, {
  host: env.dbHost,
  port: env.dbPort,
  dialect: "mysql",
  logging: env.nodeEnv === "development" ? false : false,
  define: {
    // Sequelize default camelCase <-> snake_case mapping off; we keep camelCase
    // column names to match the rest of the codebase (e.g. businessName).
    underscored: false,
    timestamps: true,
  },
});

export async function connectDatabase() {
  await sequelize.authenticate();
  console.log(`Connected to MySQL database "${env.dbName}" at ${env.dbHost}:${env.dbPort}`);
}
