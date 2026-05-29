import * as turf from "@turf/turf";
import { prisma } from "../../lib/prisma.js";
import { listContainersForMap } from "../containers/containers.service.js";
import { getCollectionPointsWithinPolygon } from "../simulation/simulation.adapter.js";

type GeoPolygon = { type: "Polygon"; coordinates: number[][][] };

function computeCentroidAndArea(geometry: GeoPolygon) {
  const poly = turf.polygon(geometry.coordinates);
  const center = turf.centroid(poly);
  const [lng, lat] = center.geometry.coordinates;
  return {
    centroidLng: lng,
    centroidLat: lat,
    areaSqM: turf.area(poly),
  };
}

export function formatZone(z: {
  idZone: string;
  idRegion: string | null;
  nombre: string;
  status: string;
  geometry: unknown;
  centroidLng: unknown;
  centroidLat: unknown;
  areaSqM: number | null;
  wasteMetadata: unknown;
  assignedVehicleIds: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: z.idZone,
    regionId: z.idRegion,
    nombre: z.nombre,
    status: z.status,
    geometry: z.geometry as GeoPolygon,
    centroidLng: z.centroidLng ? Number(z.centroidLng) : null,
    centroidLat: z.centroidLat ? Number(z.centroidLat) : null,
    areaSqM: z.areaSqM,
    wasteMetadata: z.wasteMetadata,
    assignedVehicleIds: z.assignedVehicleIds,
    createdAt: z.createdAt,
    updatedAt: z.updatedAt,
  };
}

export async function listZones(regionId?: string, catalogOnly?: boolean) {
  const rows = await prisma.zone.findMany({
    where: catalogOnly
      ? { idRegion: null }
      : regionId
        ? { idRegion: regionId }
        : undefined,
    orderBy: { nombre: "asc" },
  });
  return rows.map(formatZone);
}

export async function listZonesByRegion(regionId: string) {
  return listZones(regionId);
}

export async function getZoneById(id: string) {
  const row = await prisma.zone.findUnique({ where: { idZone: id } });
  return row ? formatZone(row) : null;
}

export async function createZone(data: {
  idRegion?: string | null;
  nombre: string;
  status?: string;
  geometry: GeoPolygon;
  wasteMetadata?: unknown;
  assignedVehicleIds?: number[];
  assignContainers?: boolean;
}) {
  const { centroidLng, centroidLat, areaSqM } = computeCentroidAndArea(
    data.geometry
  );

  const row = await prisma.zone.create({
    data: {
      idRegion: data.idRegion ?? null,
      nombre: data.nombre,
      status: data.status ?? "active",
      geometry: data.geometry,
      centroidLng,
      centroidLat,
      areaSqM,
      wasteMetadata: data.wasteMetadata ?? undefined,
      assignedVehicleIds: data.assignedVehicleIds ?? undefined,
    },
  });

  if (data.assignContainers !== false) {
    await assignContainersInZone(row.idZone, data.geometry, data.nombre);
  }

  return formatZone(row);
}

export async function updateZone(
  id: string,
  data: Partial<{
    nombre: string;
    status: string;
    geometry: GeoPolygon;
    wasteMetadata: unknown;
    assignedVehicleIds: number[];
    assignContainers: boolean;
  }>
) {
  const existing = await prisma.zone.findUnique({ where: { idZone: id } });
  if (!existing) return null;

  const geometry = (data.geometry ?? existing.geometry) as GeoPolygon;
  const meta = computeCentroidAndArea(geometry);

  const row = await prisma.zone.update({
    where: { idZone: id },
    data: {
      nombre: data.nombre,
      status: data.status,
      geometry: data.geometry ?? undefined,
      centroidLng: meta.centroidLng,
      centroidLat: meta.centroidLat,
      areaSqM: meta.areaSqM,
      wasteMetadata: data.wasteMetadata ?? undefined,
      assignedVehicleIds: data.assignedVehicleIds ?? undefined,
    },
  });

  if (data.assignContainers || data.geometry) {
    await assignContainersInZone(id, geometry, row.nombre);
  }

  return formatZone(row);
}

export async function deleteZone(id: string) {
  await prisma.contenedor.updateMany({
    where: { idZone: id },
    data: { idZone: null },
  });
  await prisma.zone.delete({ where: { idZone: id } });
}

export async function assignContainersInZone(
  zoneId: string,
  geometry: GeoPolygon,
  zoneNombre: string
) {
  const all = await listContainersForMap();
  const inside = getCollectionPointsWithinPolygon(all, geometry);
  const insideIds = inside.map((c) => c.id);

  await prisma.contenedor.updateMany({
    where: { idZone: zoneId, idContenedor: { notIn: insideIds } },
    data: { idZone: null },
  });

  if (insideIds.length > 0) {
    await prisma.contenedor.updateMany({
      where: { idContenedor: { in: insideIds } },
      data: { idZone: zoneId, zona: zoneNombre },
    });
  }
}

export async function listZoneContainers(zoneId: string) {
  const zone = await getZoneById(zoneId);
  if (!zone) return [];

  const all = await listContainersForMap();
  return getCollectionPointsWithinPolygon(all, zone.geometry);
}
