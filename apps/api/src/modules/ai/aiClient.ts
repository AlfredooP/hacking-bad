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

export interface OptimizeRouteInput {
  containers: {
    id: number;
    latitud: number;
    longitud: number;
    volumenPct: number;
    prioridad: string;
    tipoResiduo: string;
  }[];
  trucks: {
    id: number;
    latitud: number;
    longitud: number;
    capacidadDisponible: number;
    tipoResiduos: string;
  }[];
}

export interface OptimizeRouteResult {
  truckId: number | null;
  route: number[];
  metrics: {
    totalContainers: number;
    estimatedVolume: number;
    urgencyScore: number;
  };
}

export async function optimizeRoute(
  env: Env,
  input: OptimizeRouteInput
): Promise<OptimizeRouteResult> {
  try {
    const res = await fetch(`${env.AI_SERVICE_URL}/internal/v1/optimize-route`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": env.AI_SERVICE_TOKEN,
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "AI service returned error on optimizeRoute");
      return fallbackOptimize(input);
    }

    const data = (await res.json()) as OptimizeRouteResult;
    return data;
  } catch (err) {
    logger.warn({ err }, "AI service unreachable for optimizeRoute, using fallback");
    return fallbackOptimize(input);
  }
}

function fallbackOptimize(input: OptimizeRouteInput): OptimizeRouteResult {
  const critical = input.containers.filter((c) => c.volumenPct >= 70 || c.prioridad === "alta");
  if (critical.length === 0 || input.trucks.length === 0) {
    return {
      truckId: input.trucks[0]?.id ?? null,
      route: [],
      metrics: { totalContainers: 0, estimatedVolume: 0, urgencyScore: 0 },
    };
  }

  const truck = input.trucks[0];
  let currentLat = truck.latitud;
  let currentLng = truck.longitud;
  const unvisited = [...critical];
  const route: number[] = [];

  while (unvisited.length > 0) {
    let bestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const c = unvisited[i];
      const d = Math.pow(c.latitud - currentLat, 2) + Math.pow(c.longitud - currentLng, 2);
      if (d < minDistance) {
        minDistance = d;
        bestIndex = i;
      }
    }

    const nextContainer = unvisited.splice(bestIndex, 1)[0];
    route.push(nextContainer.id);
    currentLat = nextContainer.latitud;
    currentLng = nextContainer.longitud;
  }

  return {
    truckId: truck.id,
    route,
    metrics: {
      totalContainers: route.length,
      estimatedVolume: route.length * 150,
      urgencyScore: 85,
    },
  };
}
