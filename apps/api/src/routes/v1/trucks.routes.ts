import { Router } from "express";
import type { Env } from "../../config/env.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import * as trucksService from "../../modules/trucks/trucks.service.js";

export function trucksRoutes(env: Env): Router {
  const router = Router();
  const auth = createAuthMiddleware(env);

  router.get("/", auth, async (_req, res, next) => {
    try {
      const data = await trucksService.listTrucks();
      res.json({ trucks: data });
    } catch (e) {
      next(e);
    }
  });

  router.post("/", auth, async (req, res, next) => {
    try {
      const data = await trucksService.createTruck(req.body);
      res.status(201).json({ truck: data });
    } catch (e) {
      next(e);
    }
  });

  router.put("/:id", auth, async (req, res, next) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const data = await trucksService.updateTruck(id, req.body);
      res.json({ truck: data });
    } catch (e) {
      next(e);
    }
  });

  router.delete("/:id", auth, async (req, res, next) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      await trucksService.deleteTruck(id);
      res.json({ message: "Truck deleted successfully" });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
