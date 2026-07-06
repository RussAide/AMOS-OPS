import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

export const env = {
  appId: required("APP_ID"),
  appSecret: required("APP_SECRET"),
  jwtSecret: required("JWT_SECRET") || "amos-ops-dev-secret-change-in-production",
  isProduction: process.env.NODE_ENV === "production",
  databasePath: process.env.DATABASE_PATH || "amos-ops.db",
  databaseUrl: process.env.DATABASE_URL || "",
};
