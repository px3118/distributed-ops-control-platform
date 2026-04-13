import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider
} from "fastify-type-provider-zod";
import { db } from "./db/client";
import { ApiError } from "./lib/errors";
import { env } from "./lib/env";
import { registerHealthRoutes } from "./routes/health";
import { registerV1Routes } from "./routes/v1";

export function buildServer() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      base: {
        service: "distributed-ops-control-platform-api"
      }
    }
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(cors, {
    origin: true
  });

  app.decorate("db", db);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      request.log.warn(
        {
          err: error,
          details: error.details
        },
        "API domain error"
      );
      reply.status(error.statusCode).send({
        error: {
          message: error.message,
          details: error.details ?? null
        }
      });
      return;
    }

    request.log.error({ err: error }, "Unhandled API error");
    reply.status(500).send({
      error: {
        message: "Internal server error"
      }
    });
  });

  app.register(registerHealthRoutes);
  app.register(registerHealthRoutes, { prefix: "/api/v1" });
  app.register(registerV1Routes, { prefix: "/api/v1" });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    db: typeof db;
  }
}
