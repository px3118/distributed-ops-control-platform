import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { readCounters } from "../lib/metrics";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/health",
    {
      schema: {
        response: {
          200: z.object({
            status: z.literal("ok"),
            timestamp: z.string().datetime(),
            uptimeSeconds: z.number()
          })
        }
      }
    },
    async () => ({
      status: "ok" as const,
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime()
    })
  );

  app.get(
    "/metrics",
    {
      schema: {
        response: {
          200: z.object({
            counters: z.record(z.string(), z.number())
          })
        }
      }
    },
    async () => ({
      counters: readCounters()
    })
  );
}
