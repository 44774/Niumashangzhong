import { randomUUID } from "node:crypto";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { AppConfig } from "./config.js";
import type { Db } from "./db/client.js";
import { AppError } from "./lib/errors.js";
import { createWeatherProvider, WeatherService } from "./lib/weather.js";
import { authRoutes } from "./modules/auth/routes.js";
import { workspaceRoutes } from "./modules/workspace/routes.js";
import { shiftRoutes } from "./modules/shift/routes.js";
import { scheduleRoutes } from "./modules/schedule/routes.js";
import { changeRoutes } from "./modules/change/routes.js";
import { weatherRoutes } from "./modules/weather/routes.js";
import { notificationRoutes } from "./modules/notification/routes.js";
import { sharingRoutes } from "./modules/sharing/routes.js";

export interface BuildAppOptions {
  db: Db;
  config: AppConfig;
}

export async function buildApp({ db, config }: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.env !== "test",
    genReqId: () => randomUUID(),
  });

  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: config.jwtSecret });
  await app.register(swagger, {
    openapi: {
      info: { title: "Work Calendar API", version: "1.0.0" },
      servers: [{ url: "/api/v1" }],
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  app.addHook("onSend", async (req, reply) => {
    reply.header("x-request-id", req.id);
  });

  app.setErrorHandler((err, req, reply) => {
    let statusCode = 500;
    let code = "INTERNAL_ERROR";
    let message = "服务器内部错误";
    let details: Record<string, unknown> | null = null;

    if (err instanceof AppError) {
      statusCode = err.statusCode;
      code = err.code;
      message = err.message;
      details = err.details ?? null;
    } else if ((err as FastifyError).validation) {
      statusCode = 400;
      code = "VALIDATION_ERROR";
      message = (err as FastifyError).message;
      details = {
        fields: (err as FastifyError).validation?.map(
          (v: { instancePath?: string; params?: { missingProperty?: string } }) =>
            v.instancePath || v.params?.missingProperty,
        ),
      };
    } else if ((err as { code?: string }).code === "FST_JWT_NO_AUTHORIZATION_IN_HEADER") {
      statusCode = 401;
      code = "UNAUTHORIZED";
      message = "请先登录";
    } else {
      req.log.error({ err }, "unhandled error");
      if (config.env === "development") {
        message = (err as Error).message;
      }
    }

    reply.code(statusCode).send({
      error: { code, message, requestId: req.id, details },
    });
  });

  const weather = new WeatherService(db, createWeatherProvider(config.weatherProvider));

  await app.register(
    (instance) => authRoutes(instance, { db, wechatAppId: config.wechatAppId, wechatSecret: config.wechatSecret }),
    { prefix: "/api/v1" },
  );
  await app.register((instance) => workspaceRoutes(instance, { db }), { prefix: "/api/v1" });
  await app.register((instance) => shiftRoutes(instance, { db }), { prefix: "/api/v1" });
  await app.register((instance) => scheduleRoutes(instance, { db, weather }), { prefix: "/api/v1" });
  await app.register((instance) => changeRoutes(instance, { db }), { prefix: "/api/v1" });
  await app.register((instance) => weatherRoutes(instance, { db, weather }), { prefix: "/api/v1" });
  await app.register((instance) => notificationRoutes(instance, { db }), { prefix: "/api/v1" });
  await app.register((instance) => sharingRoutes(instance, { db, weather }), { prefix: "/api/v1" });

  return app;
}
