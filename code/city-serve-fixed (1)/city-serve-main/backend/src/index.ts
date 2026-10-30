import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { env } from "./config/env";
import { connectDatabase } from "./config/database";
import "./models"; // registers all Sequelize models + associations
import { errorHandler, notFoundHandler } from "./middleware/error";
import { generalLimiter } from "./middleware/rateLimit";

import authRoutes from "./routes/auth.routes";
import categoryRoutes from "./routes/category.routes";
import vendorRoutes from "./routes/vendor.routes";
import catalogRoutes from "./routes/catalog.routes";
import orderRoutes from "./routes/order.routes";
import reviewRoutes from "./routes/review.routes";
import searchRoutes from "./routes/search.routes";
import adminRoutes from "./routes/admin.routes";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));
app.use(generalLimiter);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    paymentsDemoMode: env.paymentsDemoMode,
    mapsDemoMode: env.mapsDemoMode,
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/vendors", vendorRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  await connectDatabase();
  app.listen(env.port, () => {
    console.log(`CityServe API listening on http://localhost:${env.port}`);
    console.log(`Payments demo mode: ${env.paymentsDemoMode}`);
    console.log(`Maps demo mode: ${env.mapsDemoMode}`);
  });
}

start().catch((err) => {
  console.error("Failed to start CityServe API:", err);
  process.exit(1);
});
