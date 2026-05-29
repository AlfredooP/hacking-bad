import type { Env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";

export interface ClassifyInput {
  containerId: number;
  tempCelsius?: number | null;
  humedad?: number | null;
  densidad?: number | null;
  distanciaBoteTapa?: number | null;
  pesoKg?: number | null;
  capacidadLitros?: number | null;
  tipoResiduoEsperado?: string | null;
  tiposResiduosPermitidos?: string[];
  prioridadConfigurada?: "alta" | "media" | "baja" | null;
}

export interface ClassifyResult {
  containerId: number;
  prioridad: "alta" | "media" | "baja";
  score: number;
  volumenPct: number;
  temperatura?: number | null;
  humedad?: number | null;
  densidad?: number | null;
  pesoKg?: number | null;
  tipoResiduoInferido?: string | null;
  confianzaInferencia?: number | null;
  contaminacionDetectada?: boolean;
  mensajeContaminacion?: string | null;
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

function inferWasteType(
  humedad: number | null | undefined,
  densidad: number | null | undefined
): { tipo: string | null; confianza: number } {
  if (humedad == null || densidad == null) return { tipo: null, confianza: 0 };

  const humAlta = humedad >= 55;
  const humBaja = humedad <= 35;
  const densBaja = densidad < 0.35;
  const densMedia = densidad >= 0.35 && densidad < 0.75;
  const densAlta = densidad >= 0.75;

  if (humAlta && densAlta) return { tipo: "Orgánicos", confianza: 0.88 };
  if (humBaja && densBaja) return { tipo: "Plástico", confianza: 0.82 };
  if (humBaja && densMedia) return { tipo: "Papel/Cartón", confianza: 0.8 };
  if (humBaja && densAlta) return { tipo: "Vidrio/Metal", confianza: 0.85 };
  return { tipo: "Reciclables", confianza: 0.55 };
}

function isCompatible(inferred: string, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  const groups: Record<string, string[]> = {
    Orgánicos: ["Orgánicos", "Orgánico"],
    Reciclables: ["Reciclables", "Plástico", "Papel/Cartón"],
    Inorgánicos: ["Inorgánicos", "Vidrio/Metal"],
    Plástico: ["Reciclables", "Plástico"],
    "Papel/Cartón": ["Reciclables", "Papel/Cartón"],
    "Vidrio/Metal": ["Inorgánicos", "Vidrio/Metal"],
  };
  const inferredSet = groups[inferred] ?? [inferred];
  return allowed.some((a) => {
    const allowedSet = groups[a] ?? [a];
    return inferredSet.some((i) => allowedSet.some((x) => x.toLowerCase() === i.toLowerCase()));
  });
}

function fallbackClassify(inputs: ClassifyInput[]): ClassifyResult[] {
  return inputs.map((c) => {
    const vol = estimateVolume(c);
    let prioridad: "alta" | "media" | "baja" = "baja";
    if (vol >= 80) prioridad = "alta";
    else if (vol >= 50) prioridad = "media";

    if (c.prioridadConfigurada) {
      const rank = { baja: 0, media: 1, alta: 2 };
      if (rank[c.prioridadConfigurada] > rank[prioridad]) prioridad = c.prioridadConfigurada;
    }

    const dens =
      c.densidad ??
      (c.pesoKg && vol > 5
        ? c.pesoKg / ((c.capacidadLitros ?? 50) * (vol / 100))
        : null);

    const { tipo, confianza } = inferWasteType(c.humedad, dens);
    const allowed =
      c.tiposResiduosPermitidos ??
      (c.tipoResiduoEsperado ? [c.tipoResiduoEsperado] : []);

    let contaminacion = false;
    let mensaje: string | null = null;
    if (tipo && allowed.length > 0 && !isCompatible(tipo, allowed)) {
      contaminacion = true;
      mensaje = `Contaminación detectada: se esperaba [${allowed.join(", ")}] pero los sensores sugieren [${tipo}]`;
      prioridad = "alta";
    }

    return {
      containerId: c.containerId,
      prioridad,
      score: contaminacion ? 0.95 : 0.7,
      volumenPct: vol,
      temperatura: c.tempCelsius,
      humedad: c.humedad,
      densidad: dens,
      pesoKg: c.pesoKg,
      tipoResiduoInferido: tipo,
      confianzaInferencia: confianza,
      contaminacionDetectada: contaminacion,
      mensajeContaminacion: mensaje,
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
    tipoResiduoInferido?: string | null;
    contaminacionDetectada?: boolean;
    capacidadMax?: number | null;
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

function effectiveWaste(c: OptimizeRouteInput["containers"][0]): string {
  if (c.contaminacionDetectada && c.tipoResiduoInferido) return c.tipoResiduoInferido;
  return c.tipoResiduoInferido ?? c.tipoResiduo;
}

function fallbackOptimize(input: OptimizeRouteInput): OptimizeRouteResult {
  const critical = input.containers.filter(
    (c) => c.volumenPct >= 70 || c.prioridad === "alta" || c.contaminacionDetectada
  );
  if (critical.length === 0 || input.trucks.length === 0) {
    return {
      truckId: input.trucks[0]?.id ?? null,
      route: [],
      metrics: { totalContainers: 0, estimatedVolume: 0, urgencyScore: 0 },
    };
  }

  const truck = input.trucks[0];
  const truckTypes = (truck.tipoResiduos ?? "").split(",").map((t) => t.trim().toLowerCase());
  const compat = critical.filter((c) => truckTypes.includes(effectiveWaste(c).toLowerCase()));

  let currentLat = truck.latitud;
  let currentLng = truck.longitud;
  const unvisited = [...compat];
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
