import { Router } from "express";
import { z } from "zod";
import type { Env } from "../../config/env.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import * as zonesService from "../../modules/zones/zones.service.js";

const polygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});

const createSchema = z.object({
  idRegion: z.string().min(1).nullable().optional(),
  nombre: z.string().min(1).max(100),
  status: z.string().max(20).optional(),
  geometry: polygonSchema,
  wasteMetadata: z.unknown().optional(),
  assignedVehicleIds: z.array(z.number()).optional(),
  assignContainers: z.boolean().optional(),
});

const updateSchema = createSchema.partial().omit({ idRegion: true });

export function zonesRoutes(env: Env): Router {
  const router = Router();
  const auth = createAuthMiddleware(env);

  router.get("/", auth, async (req, res, next) => {
    try {
      const regionId = req.query.regionId as string | undefined;
      const catalogOnly = req.query.catalogOnly === "true";
      const zones = await zonesService.listZones(regionId, catalogOnly);
      res.json({ zones });
    } catch (e) {
      next(e);
    }
  });

  router.get("/:id", auth, async (req, res, next) => {
    try {
      const zone = await zonesService.getZoneById(String(req.params.id));
      if (!zone) {
        res.status(404).json({ error: "Zona no encontrada" });
        return;
      }
      res.json(zone);
    } catch (e) {
      next(e);
    }
  });

  router.get("/:id/containers", auth, async (req, res, next) => {
    try {
      const containers = await zonesService.listZoneContainers(String(req.params.id));
      res.json({ containers });
    } catch (e) {
      next(e);
    }
  });

  router.post("/", auth, async (req, res, next) => {
    try {
      const body = createSchema.parse(req.body);
      const zone = await zonesService.createZone(body);
      res.status(201).json(zone);
    } catch (e) {
      next(e);
    }
  });

  router.put("/:id", auth, async (req, res, next) => {
    try {
      const body = updateSchema.parse(req.body);
      const zone = await zonesService.updateZone(String(req.params.id), body);
      if (!zone) {
        res.status(404).json({ error: "Zona no encontrada" });
        return;
      }
      res.json(zone);
    } catch (e) {
      next(e);
    }
  });

  router.delete("/:id", auth, async (req, res, next) => {
    try {
      await zonesService.deleteZone(String(req.params.id));
      res.status(204).send();
    } catch (e) {
      next(e);
    }
  });

  return router;
}
