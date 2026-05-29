import * as turf from "@turf/turf";
import type { Env } from "../../config/env.js";
import { listContainersForMap } from "../containers/containers.service.js";
import { listTrucks } from "../trucks/trucks.service.js";
import { optimizeRoute, type OptimizeRouteInput } from "../ai/aiClient.js";
import { getZoneById } from "../zones/zones.service.js";
import { listZonesByRegion } from "../zones/zones.service.js";

export interface MapContainer {
  id: number;
  latitud: number;
  longitud: number;
  volumenPct: number;
  prioridad: string;
  tipoResiduo: string;
  tipoResiduoInferido?: string | null;
  contaminacionDetectada: boolean;
  capacidadMax?: number | null;
}

export function getCollectionPointsWithinPolygon(
  containers: Awaited<ReturnType<typeof listContainersForMap>>,
  polygonGeoJSON: { type: string; coordinates: number[][][] }
) {
  const poly = turf.polygon(polygonGeoJSON.coordinates);
  return containers.filter((c) => {
    if (c.latitud == null || c.longitud == null) return false;
    return turf.booleanPointInPolygon(
      turf.point([c.longitud, c.latitud]),
      poly
    );
  });
}

export function buildOptimizeInput(
  containers: MapContainer[],
  trucks: OptimizeRouteInput["trucks"]
): OptimizeRouteInput {
  return { containers, trucks };
}

export async function loadTrucksForOptimize(idRegion?: string) {
  const apiTrucks = await listTrucks();
  return apiTrucks
    .filter((t) => t.latitud != null && t.longitud != null)
    .filter((t) => !idRegion || t.idRegion === idRegion)
    .map((t) => ({
      id: t.id,
      latitud: t.latitud!,
      longitud: t.longitud!,
      capacidadDisponible: t.capacidadDisponible ?? t.capacidadMax ?? 1000,
      tipoResiduos: t.tipoResiduos ?? "Orgánicos",
      estado: t.estado,
    }))
    .filter((t) => t.estado === "Disponible");
}

export function mapContainersForOptimize(
  containers: Awaited<ReturnType<typeof listContainersForMap>>
): MapContainer[] {
  return containers
    .filter(
      (c) =>
        c.latitud != null &&
        c.longitud != null &&
        c.estadoOperativo !== "Inactivo"
    )
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
}

export function mergeRegionPolygons(zones: { geometry: unknown }[]) {
  const polys: ReturnType<typeof turf.polygon>[] = [];
  for (const z of zones) {
    const g = z.geometry as { type?: string; coordinates?: number[][][] };
    if (g?.type === "Polygon" && g.coordinates) {
      polys.push(turf.polygon(g.coordinates));
    }
  }

  if (polys.length === 0) return null;
  if (polys.length === 1) return polys[0];

  let merged = polys[0];
  for (let i = 1; i < polys.length; i++) {
    const u = turf.union(turf.featureCollection([merged, polys[i]]));
    if (u) merged = u as ReturnType<typeof turf.polygon>;
  }
  return merged;
}

export async function simulateZoneRoute(env: Env, zoneId: string) {
  const zone = await getZoneById(zoneId);
  if (!zone) throw new Error("Zona no encontrada");

  const allContainers = await listContainersForMap();
  const geometry = zone.geometry as { type: string; coordinates: number[][][] };
  const inZone = getCollectionPointsWithinPolygon(allContainers, geometry);
  const trucks = await loadTrucksForOptimize(zone.regionId ?? undefined);
  const containers = mapContainersForOptimize(inZone);

  const result = await optimizeRoute(env, buildOptimizeInput(containers, trucks));
  return { ...result, zoneId, scope: "zone" as const };
}

export async function simulateRegionRoutes(env: Env, regionId: string) {
  const zones = await listZonesByRegion(regionId);
  if (zones.length === 0) throw new Error("La región no tiene zonas");

  const allContainers = await listContainersForMap();
  const trucks = await loadTrucksForOptimize(regionId);

  const zoneResults = await Promise.all(
    zones.map(async (zone) => {
      const geometry = zone.geometry as { type: string; coordinates: number[][][] };
      const inZone = getCollectionPointsWithinPolygon(allContainers, geometry);
      const containers = mapContainersForOptimize(inZone);
      if (containers.length === 0) {
        return { zoneId: zone.id, route: [], truckId: null, metrics: null };
      }
      const result = await optimizeRoute(
        env,
        buildOptimizeInput(containers, trucks)
      );
      return { zoneId: zone.id, zoneName: zone.nombre, ...result };
    })
  );

  return { regionId, scope: "region" as const, routes: zoneResults };
}

export async function simulateGlobalRoute(env: Env) {
  const allContainers = await listContainersForMap();
  const trucks = await loadTrucksForOptimize();
  const containers = mapContainersForOptimize(allContainers);
  const result = await optimizeRoute(env, buildOptimizeInput(containers, trucks));
  return { ...result, scope: "global" as const };
}
