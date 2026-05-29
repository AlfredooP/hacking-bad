import type { Env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { classifyContainers } from "../ai/aiClient.js";
import {
  getCapacidadLitros,
  persistClassificationResult,
} from "../containers/containers.service.js";
import { parseAllowedTypes } from "../containers/waste-types.js";
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
      densidad: sanitized.densidad,
      distanciaBoteTapa: sanitized.distanciaBoteTapa,
      pesoKg: sanitized.pesoKg,
    },
  });

  if (sensor.idContenedor && sensor.contenedor) {
    const container = sensor.contenedor;
    const capacidadLitros = getCapacidadLitros(container);

    const results = await classifyContainers(env, [
      {
        containerId: sensor.idContenedor,
        tempCelsius: sanitized.tempCelsius,
        humedad: sanitized.humedad,
        densidad: sanitized.densidad,
        distanciaBoteTapa: sanitized.distanciaBoteTapa,
        pesoKg: sanitized.pesoKg,
        capacidadLitros,
        tipoResiduoEsperado: container.tipoResiduo,
        tiposResiduosPermitidos: parseAllowedTypes(container.tiposResiduosPermitidos),
        prioridadConfigurada: container.prioridadConfigurada,
      },
    ]);

    for (const r of results) {
      await persistClassificationResult(sensor.idContenedor, r, container);
    }
  }

  return lectura;
}
