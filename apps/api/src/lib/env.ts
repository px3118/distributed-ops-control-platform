import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1).default("postgresql://ops:ops@localhost:5433/ops_control"),
  SYNC_STALE_MINUTES: z.coerce.number().int().positive().default(45),
  TRANSFER_CONFIRMATION_HOURS: z.coerce.number().int().positive().default(4)
});

export const env = envSchema.parse(process.env);