import { Router } from "express";
import type { Env } from "../../config/env.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import { listContainersForMap } from "../../modules/containers/containers.service.js";
import { listTrucks } from "../../modules/trucks/trucks.service.js";
import { optimizeRoute } from "../../modules/ai/aiClient.js";

export function aiRoutes(env: Env): Router {
  const router = Router();
  const auth = createAuthMiddleware(env);

  router.post("/optimize-route", auth, async (_req, res, next) => {
    try {
      const apiContainers = await listContainersForMap();
      const apiTrucks = await listTrucks();

      const containers = apiContainers
        .filter((c) => c.latitud != null && c.longitud != null && c.estadoOperativo !== "Inactivo")
        .map((c) => ({
          id: c.id,
          latitud: c.latitud!,
          longitud: c.longitud!,
          volumenPct: c.ia?.volumenPct ?? 0,
          prioridad: c.ia?.prioridadEfectiva ?? c.ia?.prioridad ?? "baja",
          tipoResiduo: c.tipoResiduo ?? "Orgánicos",
          tipoResiduoInferido: c.ia?.tipoResiduoInferido,
          contaminacionDetectada: c.ia?.contaminacionDetectada ?? false,
          capacidadMax: c.capacidadMax,
        }));

      const trucks = apiTrucks
        .filter((t) => t.latitud != null && t.longitud != null)
        .map((t) => ({
          id: t.id,
          latitud: t.latitud!,
          longitud: t.longitud!,
          capacidadDisponible: t.capacidadDisponible ?? t.capacidadMax ?? 1000,
          tipoResiduos: t.tipoResiduos ?? "Orgánicos",
          estado: t.estado,
        }))
        .filter((t) => t.estado === "Disponible");

      const result = await optimizeRoute(env, { containers, trucks });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  return router;
}
