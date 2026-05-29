import { Router } from "express";
import type { Env } from "../../config/env.js";
import { authRoutes } from "./auth.routes.js";
import { containersRoutes } from "./containers.routes.js";
import { iotRoutes } from "./iot.routes.js";
import { trucksRoutes } from "./trucks.routes.js";
import { aiRoutes } from "./ai.routes.js";
import { regionsRoutes } from "./regions.routes.js";
import { zonesRoutes } from "./zones.routes.js";

export function v1Routes(env: Env): Router {
  const router = Router();
  router.use("/auth", authRoutes(env));
  router.use("/iot", iotRoutes(env));
  router.use("/containers", containersRoutes(env));
  router.use("/trucks", trucksRoutes(env));
  router.use("/ai", aiRoutes(env));
  router.use("/regions", regionsRoutes(env));
  router.use("/zones", zonesRoutes(env));
  return router;
}
