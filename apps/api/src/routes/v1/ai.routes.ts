import { Router } from "express";
import { z } from "zod";
import type { Env } from "../../config/env.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import {
  simulateGlobalRoute,
  simulateRegionRoutes,
  simulateZoneRoute,
} from "../../modules/simulation/simulation.adapter.js";

const optimizeBodySchema = z
  .object({
    zoneId: z.string().optional(),
    regionId: z.string().optional(),
    zoneIds: z.array(z.string()).optional(),
  })
  .optional();

export function aiRoutes(env: Env): Router {
  const router = Router();
  const auth = createAuthMiddleware(env);

  router.post("/optimize-route", auth, async (req, res, next) => {
    try {
      const body = optimizeBodySchema.parse(req.body ?? {});

      let result;
      if (body?.regionId) {
        result = await simulateRegionRoutes(env, body.regionId);
      } else if (body?.zoneId) {
        result = await simulateZoneRoute(env, body.zoneId);
      } else {
        result = await simulateGlobalRoute(env);
      }

      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  return router;
}
