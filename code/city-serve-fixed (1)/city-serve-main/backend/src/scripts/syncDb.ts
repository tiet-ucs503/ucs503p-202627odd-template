/**
 * Creates/updates all MySQL tables from the Sequelize model definitions.
 * This is the plain-MySQL equivalent of `prisma migrate` — no Prisma involved.
 *
 * Run with: npm run db:sync
 *
 * For a real production project you'd normally reach for a proper migration
 * tool (umzug, sequelize-cli migrations, etc). For this project's scope,
 * `sequelize.sync({ alter: true })` is sufficient and keeps the setup simple.
 */
import { sequelize, connectDatabase } from "../config/database";
import "../models";

async function main() {
  await connectDatabase();

  console.log("Disabling foreign key checks...");
  await sequelize.query("SET FOREIGN_KEY_CHECKS = 0;");

  console.log("Syncing database with force: true...");
  await sequelize.sync({ force: true });

  console.log("Re-enabling foreign key checks...");
  await sequelize.query("SET FOREIGN_KEY_CHECKS = 1;");
  console.log("All CityServe tables are in sync with the models.");
  await sequelize.close();
}

main().catch((err) => {
  console.error("Failed to sync database:", err);
  process.exit(1);
});
