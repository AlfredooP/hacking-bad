import { Router } from "express";
import type { Env } from "../../config/env.js";
import { authRoutes } from "./auth.routes.js";
import { containersRoutes } from "./containers.routes.js";
import { iotRoutes } from "./iot.routes.js";

export function v1Routes(env: Env): Router {
  const router = Router();
  router.use("/auth", authRoutes(env));
  router.use("/iot", iotRoutes(env));
  router.use("/containers", containersRoutes(env));
  return router;
}
