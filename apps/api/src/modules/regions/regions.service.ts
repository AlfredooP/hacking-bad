import { prisma } from "../../lib/prisma.js";

export function formatRegion(r: {
  idRegion: string;
  nombre: string;
  metadata: unknown;
  kpis: unknown;
  simSettings: unknown;
  createdAt: Date;
  updatedAt: Date;
  zones?: { idZone: string }[];
}) {
  return {
    id: r.idRegion,
    nombre: r.nombre,
    metadata: r.metadata,
    kpis: r.kpis,
    simSettings: r.simSettings,
    zoneCount: r.zones?.length,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function listRegions() {
  const rows = await prisma.region.findMany({
    include: { zones: { select: { idZone: true } } },
    orderBy: { nombre: "asc" },
  });
  return rows.map(formatRegion);
}

export async function getRegionById(id: string) {
  const row = await prisma.region.findUnique({
    where: { idRegion: id },
    include: { zones: true },
  });
  return row ? { ...formatRegion(row), zones: row.zones.map(formatZoneRef) } : null;
}

function formatZoneRef(z: {
  idZone: string;
  nombre: string;
  status: string;
  geometry: unknown;
  centroidLng: unknown;
  centroidLat: unknown;
  areaSqM: number | null;
}) {
  return {
    id: z.idZone,
    nombre: z.nombre,
    status: z.status,
    geometry: z.geometry,
    centroidLng: z.centroidLng ? Number(z.centroidLng) : null,
    centroidLat: z.centroidLat ? Number(z.centroidLat) : null,
    areaSqM: z.areaSqM,
  };
}

export async function createRegion(data: {
  nombre: string;
  metadata?: unknown;
  kpis?: unknown;
  simSettings?: unknown;
}) {
  const row = await prisma.region.create({
    data: {
      nombre: data.nombre,
      metadata: data.metadata ?? undefined,
      kpis: data.kpis ?? undefined,
      simSettings: data.simSettings ?? undefined,
    },
  });
  return formatRegion(row);
}

export async function updateRegion(
  id: string,
  data: Partial<{
    nombre: string;
    metadata: unknown;
    kpis: unknown;
    simSettings: unknown;
  }>
) {
  const row = await prisma.region.update({
    where: { idRegion: id },
    data: {
      nombre: data.nombre,
      metadata: data.metadata ?? undefined,
      kpis: data.kpis ?? undefined,
      simSettings: data.simSettings ?? undefined,
    },
  });
  return formatRegion(row);
}

export async function deleteRegion(id: string) {
  await prisma.zone.updateMany({
    where: { idRegion: id },
    data: { idRegion: null },
  });
  await prisma.region.delete({ where: { idRegion: id } });
}

/** Assign zones from the global catalog to a region (replaces current membership). */
export async function setRegionZones(regionId: string, zoneIds: string[]) {
  const region = await prisma.region.findUnique({
    where: { idRegion: regionId },
  });
  if (!region) return null;

  await prisma.zone.updateMany({
    where: { idRegion: regionId, idZone: { notIn: zoneIds } },
    data: { idRegion: null },
  });

  if (zoneIds.length > 0) {
    await prisma.zone.updateMany({
      where: { idZone: { in: zoneIds } },
      data: { idRegion: regionId },
    });
  }

  return getRegionById(regionId);
}
