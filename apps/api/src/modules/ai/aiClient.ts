import type { Env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";

export interface ClassifyInput {
  containerId: number;
  tempCelsius?: number | null;
  humedad?: number | null;
  distanciaBoteTapa?: number | null;
  pesoKg?: number | null;
  capacidadLitros?: number | null;
}

export interface ClassifyResult {
  containerId: number;
  prioridad: "alta" | "media" | "baja";
  score: number;
  volumenPct: number;
  temperatura?: number | null;
  humedad?: number | null;
  pesoKg?: number | null;
}

export async function classifyContainers(
  env: Env,
  inputs: ClassifyInput[]
): Promise<ClassifyResult[]> {
  if (inputs.length === 0) return [];

  try {
    const res = await fetch(`${env.AI_SERVICE_URL}/internal/v1/classify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": env.AI_SERVICE_TOKEN,
      },
      body: JSON.stringify({ containers: inputs }),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "AI service returned error");
      return fallbackClassify(inputs);
    }

    const data = (await res.json()) as { results: ClassifyResult[] };
    return data.results;
  } catch (err) {
    logger.warn({ err }, "AI service unreachable, using fallback");
    return fallbackClassify(inputs);
  }
}

function fallbackClassify(inputs: ClassifyInput[]): ClassifyResult[] {
  return inputs.map((c) => {
    const vol = estimateVolume(c);
    let prioridad: "alta" | "media" | "baja" = "baja";
    if (vol >= 80) prioridad = "alta";
    else if (vol >= 50) prioridad = "media";
    return {
      containerId: c.containerId,
      prioridad,
      score: 0.7,
      volumenPct: vol,
      temperatura: c.tempCelsius,
      humedad: c.humedad,
      pesoKg: c.pesoKg,
    };
  });
}

function estimateVolume(c: ClassifyInput): number {
  if (c.distanciaBoteTapa != null && c.distanciaBoteTapa > 0 && c.distanciaBoteTapa < 400) {
    return Math.min(100, Math.max(0, (1 - c.distanciaBoteTapa / 200) * 100));
  }
  if (c.pesoKg != null && c.pesoKg > 0) {
    const cap = parseCapacity(c.capacidadLitros);
    return Math.min(100, (c.pesoKg / cap) * 100);
  }
  return 0;
}

function parseCapacity(cap?: number | null): number {
  return cap && cap > 0 ? cap : 50;
}
