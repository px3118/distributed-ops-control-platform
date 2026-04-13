import type { FastifyBaseLogger } from "fastify";

export function logOperation(
  logger: FastifyBaseLogger,
  message: string,
  details?: Record<string, unknown>
): void {
  logger.info({ ...details }, message);
}