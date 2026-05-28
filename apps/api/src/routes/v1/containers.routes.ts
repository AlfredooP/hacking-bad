import { Router } from "express";
import type { Env } from "../../config/env.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import * as containersService from "../../modules/containers/containers.service.js";

export function containersRoutes(env: Env): Router {
  const router = Router();
  const auth = createAuthMiddleware(env);

  router.get("/", auth, async (_req, res, next) => {
    try {
      const data = await containersService.listContainersForMap();
      res.json({ containers: data });
    } catch (e) {
      next(e);
    }
  });

  router.get("/map", auth, async (_req, res, next) => {
    try {
      const data = await containersService.listContainersForMap();
      res.json({ containers: data });
    } catch (e) {
      next(e);
    }
  });

  router.get("/stats", auth, async (_req, res, next) => {
    try {
      const stats = await containersService.getDashboardStats();
      res.json(stats);
    } catch (e) {
      next(e);
    }
  });

  router.put("/:id", auth, async (req, res, next) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (req.body.empty) {
        await containersService.emptyContainer(id);
        res.json({ message: "Container emptied" });
      } else {
        const updated = await containersService.updateContainer(id, req.body);
        res.json({ container: updated });
      }
    } catch (e) {
      next(e);
    }
  });

  return router;
}
