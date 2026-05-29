import { api } from "@/lib/api-client";

/**
 * Fetch OSRM driving geometry for ordered stops.
 * @param {Array<[number, number]>} points - [lng, lat]
 */
export async function fetchRouteGeometry(points) {
  try {
    const coordinatesString = points.map((p) => `${p[0]},${p[1]}`).join(";");
    const osrmRes = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordinatesString}?geometries=geojson&overview=full`
    );
    const osrmData = await osrmRes.json();
    if (osrmData.routes?.[0]?.geometry) {
      return osrmData.routes[0].geometry;
    }
  } catch (err) {
    console.warn("OSRM routing failed:", err);
  }
  return { type: "LineString", coordinates: points };
}

/**
 * Build activeRoute from optimize API response.
 */
export async function buildActiveRoute(res, trucks, containers) {
  const selectedTruck = trucks.find((t) => t.id === res.truckId);
  if (!selectedTruck) return null;

  const orderedContainers = res.route
    .map((id) => containers.find((c) => c.id === id))
    .filter(Boolean);

  const points = [
    [selectedTruck.longitud, selectedTruck.latitud],
    ...orderedContainers.map((c) => [c.longitud, c.latitud]),
    [selectedTruck.longitud, selectedTruck.latitud],
  ];

  const geometry = await fetchRouteGeometry(points);

  return {
    truck: selectedTruck,
    containers: orderedContainers,
    geometry,
    metrics: res.metrics,
    scope: res.scope,
    zoneId: res.zoneId,
    regionId: res.regionId,
  };
}

/** @param {string} zoneId */
export async function simulateZoneRoute(zoneId) {
  const res = await api.aiOptimizeRoute({ zoneId });
  return res;
}

/** @param {string} regionId */
export async function simulateRegionRoutes(regionId) {
  const res = await api.aiOptimizeRoute({ regionId });
  return res;
}

export async function optimizeGlobalRoute() {
  return api.aiOptimizeRoute({});
}
