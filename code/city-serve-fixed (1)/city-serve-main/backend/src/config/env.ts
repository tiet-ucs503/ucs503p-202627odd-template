import dotenv from "dotenv";
dotenv.config();

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:3000",

  dbHost: required("DB_HOST", "localhost"),
  dbPort: Number(process.env.DB_PORT ?? 3306),
  dbName: required("DB_NAME", "cityserve"),
  dbUser: required("DB_USER", "cityserve"),
  dbPassword: required("DB_PASSWORD", "cityserve_pw"),

  jwtAccessSecret: required("JWT_ACCESS_SECRET", "dev_access_secret_change_me"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET", "dev_refresh_secret_change_me"),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",

  mapboxToken: process.env.MAPBOX_ACCESS_TOKEN ?? "",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY ?? "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  get paymentsDemoMode() {
    return !this.razorpayKeyId || !this.razorpayKeySecret;
  },
  get mapsDemoMode() {
    return !this.mapboxToken;
  },
};
