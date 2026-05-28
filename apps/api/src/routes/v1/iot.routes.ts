import { Router } from "express";
import { z } from "zod";
import type { Env } from "../../config/env.js";
import { createIotAuthMiddleware } from "../../middleware/iotAuth.js";
import { ingestReading } from "../../modules/iot/iot.service.js";

const readingSchema = z.object({
  id_sensor: z.number().int().positive(),
  tempCelsius: z.number().optional().nullable(),
  humedad: z.number().optional().nullable(),
  distanciaBoteTapa: z.number().optional().nullable(),
  pesoKg: z.number().optional().nullable(),
});

export function iotRoutes(env: Env): Router {
  const router = Router();
  const iotAuth = createIotAuthMiddleware(env);

  router.post("/readings", iotAuth, async (req, res, next) => {
    try {
      const body = readingSchema.parse(req.body);
      const lectura = await ingestReading(env, body);
      res.status(201).json({
        id_lectura: lectura.idLectura,
        message: "Reading stored",
      });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
