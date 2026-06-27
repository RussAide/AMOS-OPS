import "dotenv/config";

export const env = {
  appId: process.env.APP_ID || "amos-ops",
  appSecret: process.env.APP_SECRET || "amos-ops-secret",
  jwtSecret: process.env.JWT_SECRET || "amos-ops-dev-secret-change-in-production",
  isProduction: process.env.NODE_ENV === "production",
  databasePath: process.env.DATABASE_PATH || "amos-ops.db",
};
