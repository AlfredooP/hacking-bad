import { api } from "@/lib/api-client";

export async function listRegions() {
  const res = await api.regionsList();
  return res.regions || [];
}

/** All zones in the system catalog. */
export async function listZoneCatalog() {
  const res = await api.zonesList();
  return res.zones || [];
}

/** Zones assigned to a region. */
export async function listZones(regionId) {
  if (!regionId) return [];
  const res = await api.zonesList({ regionId });
  return res.zones || [];
}

export async function createZone(payload) {
  return api.zoneCreate(payload);
}

export async function updateZone(id, payload) {
  return api.zoneUpdate(id, payload);
}

export async function deleteZone(id) {
  return api.zoneDelete(id);
}

export async function getZoneContainers(zoneId) {
  const res = await api.zoneContainers(zoneId);
  return res.containers || [];
}

export async function setRegionZones(regionId, zoneIds) {
  return api.regionSetZones(regionId, zoneIds);
}
