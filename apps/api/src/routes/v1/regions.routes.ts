import { Router } from "express";
import { z } from "zod";
import type { Env } from "../../config/env.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import * as regionsService from "../../modules/regions/regions.service.js";

const createSchema = z.object({
  nombre: z.string().min(1).max(100),
  metadata: z.unknown().optional(),
  kpis: z.unknown().optional(),
  simSettings: z.unknown().optional(),
});

const updateSchema = createSchema.partial();

const setZonesSchema = z.object({
  zoneIds: z.array(z.string().min(1)),
});

export function regionsRoutes(env: Env): Router {
  const router = Router();
  const auth = createAuthMiddleware(env);

  router.get("/", auth, async (_req, res, next) => {
    try {
      const regions = await regionsService.listRegions();
      res.json({ regions });
    } catch (e) {
      next(e);
    }
  });

  router.get("/:id", auth, async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const region = await regionsService.getRegionById(id);
      if (!region) {
        res.status(404).json({ error: "Región no encontrada" });
        return;
      }
      res.json(region);
    } catch (e) {
      next(e);
    }
  });

  router.post("/", auth, async (req, res, next) => {
    try {
      const body = createSchema.parse(req.body);
      const region = await regionsService.createRegion(body);
      res.status(201).json(region);
    } catch (e) {
      next(e);
    }
  });

  router.put("/:id", auth, async (req, res, next) => {
    try {
      const body = updateSchema.parse(req.body);
      const region = await regionsService.updateRegion(String(req.params.id), body);
      res.json(region);
    } catch (e) {
      next(e);
    }
  });

  router.delete("/:id", auth, async (req, res, next) => {
    try {
      await regionsService.deleteRegion(String(req.params.id));
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  });

  router.put("/:id/zones", auth, async (req, res, next) => {
    try {
      const body = setZonesSchema.parse(req.body);
      const region = await regionsService.setRegionZones(
        String(req.params.id),
        body.zoneIds
      );
      if (!region) {
        res.status(404).json({ error: "Región no encontrada" });
        return;
      }
      res.json(region);
    } catch (e) {
      next(e);
    }
  });

  return router;
}
