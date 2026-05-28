import { PrioridadIa } from "@prisma/client";
import type { Env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { classifyContainers } from "../ai/aiClient.js";
import { sanitizeReading, type RawReading } from "./sanitize.js";

export async function ingestReading(env: Env, raw: RawReading) {
  const sanitized = sanitizeReading(raw);
  if (!sanitized) {
    throw Object.assign(new Error("Invalid reading payload"), { status: 400 });
  }

  const sensor = await prisma.sensor.findUnique({
    where: { idSensor: sanitized.idSensor },
    include: { contenedor: true },
  });

  if (!sensor) {
    throw Object.assign(new Error("Sensor not found"), { status: 404 });
  }

  const lectura = await prisma.lecturaSensor.create({
    data: {
      idSensor: sanitized.idSensor,
      fechaHora: new Date(),
      tempCelsius: sanitized.tempCelsius,
      humedad: sanitized.humedad,
      distanciaBoteTapa: sanitized.distanciaBoteTapa,
      pesoKg: sanitized.pesoKg,
    },
  });

  if (sensor.idContenedor) {
    const capMatch = sensor.contenedor?.capacidad?.match(/(\d+)/);
    const capacidadLitros = capMatch ? parseInt(capMatch[1], 10) : null;

    const results = await classifyContainers(env, [
      {
        containerId: sensor.idContenedor,
        tempCelsius: sanitized.tempCelsius,
        humedad: sanitized.humedad,
        distanciaBoteTapa: sanitized.distanciaBoteTapa,
        pesoKg: sanitized.pesoKg,
        capacidadLitros,
      },
    ]);

    for (const r of results) {
      await prisma.resultadoIa.upsert({
        where: { idContenedor: r.containerId },
        create: {
          idContenedor: r.containerId,
          prioridad: r.prioridad as PrioridadIa,
          score: r.score,
          volumenPct: r.volumenPct,
          temperatura: r.temperatura ?? undefined,
          humedad: r.humedad ?? undefined,
          pesoKg: r.pesoKg ?? undefined,
        },
        update: {
          prioridad: r.prioridad as PrioridadIa,
          score: r.score,
          volumenPct: r.volumenPct,
          temperatura: r.temperatura ?? undefined,
          humedad: r.humedad ?? undefined,
          pesoKg: r.pesoKg ?? undefined,
          fechaClasificacion: new Date(),
        },
      });
    }
  }

  return lectura;
}
