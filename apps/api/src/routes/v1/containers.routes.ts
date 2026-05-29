import { Router } from "express";
import { z } from "zod";
import type { Env } from "../../config/env.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import * as containersService from "../../modules/containers/containers.service.js";

const createSchema = z.object({
  nombre: z.string().min(1).max(100),
  ubicacion: z.string().max(100).optional(),
  zona: z.string().max(50).optional(),
  latitud: z.number().optional(),
  longitud: z.number().optional(),
  capacidadMax: z.number().positive().optional(),
  estado: z.string().max(20).optional(),
  estadoOperativo: z.string().max(20).optional(),
  tipoResiduo: z.string().max(50).optional(),
  tiposResiduosPermitidos: z.array(z.string()).optional(),
  prioridadConfigurada: z.enum(["alta", "media", "baja"]).optional(),
  sensores: z.array(z.object({ tipoSensor: z.string() })).optional(),
});

const updateSchema = createSchema.partial().extend({
  prioridadConfigurada: z.enum(["alta", "media", "baja"]).nullable().optional(),
});

export function containersRoutes(env: Env): Router {
  const router = Router();
  const auth = createAuthMiddleware(env);

  router.get("/", auth, async (req, res, next) => {
    try {
      const data = await containersService.listContainersForMap({
        zona: req.query.zona as string | undefined,
        tipoResiduo: req.query.tipoResiduo as string | undefined,
        prioridad: req.query.prioridad as string | undefined,
        soloContaminacion: req.query.soloContaminacion === "true",
      });
      res.json({ containers: data });
    } catch (e) {
      next(e);
    }
  });

  router.get("/map", auth, async (req, res, next) => {
    try {
      const data = await containersService.listContainersForMap({
        zona: req.query.zona as string | undefined,
        tipoResiduo: req.query.tipoResiduo as string | undefined,
        prioridad: req.query.prioridad as string | undefined,
        soloContaminacion: req.query.soloContaminacion === "true",
      });
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

  router.get("/alerts", auth, async (req, res, next) => {
    try {
      const resueltas =
        req.query.resueltas === "true"
          ? true
          : req.query.resueltas === "false"
            ? false
            : undefined;
      const alerts = await containersService.listContaminationAlerts(resueltas);
      res.json({ alerts });
    } catch (e) {
      next(e);
    }
  });

  router.patch("/alerts/:id/resolve", auth, async (req, res, next) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      await containersService.resolveContaminationAlert(id);
      res.json({ message: "Alert resolved" });
    } catch (e) {
      next(e);
    }
  });

  router.get("/:id", auth, async (req, res, next) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const container = await containersService.getContainerById(id);
      if (!container) {
        res.status(404).json({ error: "Container not found" });
        return;
      }
      res.json({ container });
    } catch (e) {
      next(e);
    }
  });

  router.post("/", auth, async (req, res, next) => {
    try {
      const body = createSchema.parse(req.body);
      const container = await containersService.createContainer(body);
      res.status(201).json({ container });
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
        return;
      }
      const body = updateSchema.parse(req.body);
      const container = await containersService.updateContainer(id, body);
      res.json({ container });
    } catch (e) {
      next(e);
    }
  });

  router.delete("/:id", auth, async (req, res, next) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      await containersService.deleteContainer(id);
      res.json({ message: "Container deleted" });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
