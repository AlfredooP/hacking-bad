import * as turf from "@turf/turf";
import { L } from "../map/leaflet-map-factory.js";

const DEFAULT_MAX_ZOOM = 16;
const CLOSE_VERTEX_PX = 14;
const MIN_VERTEX_DISTANCE_M = 1;

/**
 * GIS centroid (geometric mean of vertices) — best for labels and admin references.
 * @param {Array<[number, number]>|Array<{lat:number,lng:number}>} ring - [lng,lat] or latLng objects
 * @param {"centroid"|"centerOfMass"} [method="centroid"]
 * @returns {{ lng: number, lat: number }}
 */
export function calculatePolygonCenter(ring, method = "centroid") {
  const coords = normalizeRing(ring);
  const poly = turf.polygon([coords]);
  const point =
    method === "centerOfMass" ? turf.centerOfMass(poly) : turf.centroid(poly);
  const [lng, lat] = point.geometry.coordinates;
  return { lng, lat };
}

/** @param {Array<[number, number]>} ring */
export function calculatePolygonAreaSqM(ring) {
  const coords = normalizeRing(ring);
  return turf.area(turf.polygon([coords]));
}

/**
 * Responsive fitBounds padding from map container size.
 * @param {import("leaflet").Map} map
 * @param {object} [options]
 */
export function calculateBoundsPadding(map, options = {}) {
  const size = map.getSize();
  const ratio = options.ratio ?? 0.08;
  const minPad = options.minPad ?? 40;
  const pad = Math.max(minPad, Math.round(Math.min(size.x, size.y) * ratio));
  return [pad, pad];
}

/**
 * Focus map on a GeoJSON polygon or latLng ring with smooth animation.
 * @param {import("leaflet").Map} map
 * @param {object|Array} polygon - GeoJSON Polygon or [lat,lng][] / [lng,lat][]
 * @param {{ maxZoom?: number, padding?: number|[number,number] }} [options]
 */
export function focusZoneOnMap(map, polygon, options = {}) {
  const maxZoom = options.maxZoom ?? DEFAULT_MAX_ZOOM;
  const padding =
    options.padding ?? calculateBoundsPadding(map, { ratio: 0.1 });

  let layer;
  if (Array.isArray(polygon)) {
    const latLngs = polygon.map((p) =>
      Array.isArray(p) && p.length >= 2
        ? p[0] > 90 || p[0] < -90
          ? [p[1], p[0]]
          : [p[0], p[1]]
        : [p.lat, p.lng]
    );
    layer = { getBounds: () => LlatLngBoundsFromLatLngs(latLngs) };
  } else {
    const gj = L.geoJSON(polygon);
    layer = gj;
    const bounds = gj.getBounds();
    gj.remove();
    if (!bounds.isValid()) return;
    map.fitBounds(bounds, { padding, maxZoom, animate: true, duration: 0.5 });
    return;
  }

  const bounds = layer.getBounds();
  if (bounds?.isValid?.()) {
    map.fitBounds(bounds, { padding, maxZoom, animate: true, duration: 0.5 });
  }
}

function LlatLngBoundsFromLatLngs(latLngs) {
  return L.latLngBounds(latLngs);
}

/**
 * @param {Array<{ id?: number, latitud: number, longitud: number }>} points
 * @param {object} polygonGeoJSON - GeoJSON Polygon
 */
export function getCollectionPointsWithinPolygon(points, polygonGeoJSON) {
  const poly =
    polygonGeoJSON.type === "Feature"
      ? polygonGeoJSON
      : turf.polygon(polygonGeoJSON.coordinates);

  const fc = turf.featureCollection(
    points
      .filter((p) => p.latitud != null && p.longitud != null)
      .map((p) =>
        turf.point([p.longitud, p.latitud], { id: p.id, ...p })
      )
  );

  const inside = turf.pointsWithinPolygon(fc, poly);
  return inside.features.map((f) => ({
    ...f.properties,
    latitud: f.geometry.coordinates[1],
    longitud: f.geometry.coordinates[0],
  }));
}

/**
 * Merge zone polygons for region-wide bounding / future union ops.
 * @param {Array<{ geometry: object }>} zoneFeatures
 */
export function mergeRegionPolygons(zoneFeatures) {
  if (!zoneFeatures?.length) return null;
  const polys = zoneFeatures
    .map((z) => {
      const g = z.geometry;
      if (!g || g.type !== "Polygon") return null;
      return turf.polygon(g.coordinates, z.properties || {});
    })
    .filter(Boolean);

  if (polys.length === 0) return null;
  if (polys.length === 1) return polys[0];

  let merged = polys[0];
  for (let i = 1; i < polys.length; i++) {
    try {
      const u = turf.union(turf.featureCollection([merged, polys[i]]));
      if (u) merged = u;
    } catch {
      return turf.featureCollection(polys);
    }
  }
  return merged;
}

/**
 * @param {Array<[number, number]>|Array<{lat:number,lng:number}>} ring
 * @returns {{ valid: boolean, error?: string, ring?: Array<[number,number]> }}
 */
export function validatePolygon(ring) {
  const coords = normalizeRing(ring);
  if (coords.length < 4) {
    return { valid: false, error: "Se requieren al menos 3 vértices." };
  }

  const poly = turf.polygon([coords]);
  if (!turf.booleanValid(poly)) {
    return { valid: false, error: "Polígono inválido (geometría degenerada)." };
  }

  const kinks = turf.kinks(poly);
  if (kinks.features.length > 0) {
    return { valid: false, error: "El polígono no puede autointersectarse." };
  }

  if (turf.area(poly) <= 0) {
    return { valid: false, error: "El área del polígono debe ser mayor que cero." };
  }

  return { valid: true, ring: coords };
}

/**
 * @param {Array<{lat:number,lng:number}>} latLngs
 * @returns {object} GeoJSON Polygon
 */
export function toGeoJSONPolygon(latLngs) {
  const ring = latLngs.map((p) => [p.lng, p.lat]);
  if (
    ring.length > 0 &&
    (ring[0][0] !== ring[ring.length - 1][0] ||
      ring[0][1] !== ring[ring.length - 1][1])
  ) {
    ring.push([...ring[0]]);
  }
  return { type: "Polygon", coordinates: [ring] };
}

/**
 * @param {import("leaflet").Map} map
 * @param {import("leaflet").LatLng} a
 * @param {import("leaflet").LatLng} b
 */
export function pixelDistance(map, a, b) {
  const pa = map.latLngToContainerPoint(a);
  const pb = map.latLngToContainerPoint(b);
  return Math.hypot(pa.x - pb.x, pa.y - pb.y);
}

export function isNearFirstVertex(map, clickLatLng, firstLatLng) {
  return pixelDistance(map, clickLatLng, firstLatLng) <= CLOSE_VERTEX_PX;
}

/**
 * Skip duplicate consecutive vertices.
 * @param {import("leaflet").LatLng[]} vertices
 * @param {import("leaflet").LatLng} candidate
 */
export function isDuplicateVertex(vertices, candidate) {
  if (vertices.length === 0) return false;
  const last = vertices[vertices.length - 1];
  const from = turf.point([last.lng, last.lat]);
  const to = turf.point([candidate.lng, candidate.lat]);
  return turf.distance(from, to, { units: "meters" }) < MIN_VERTEX_DISTANCE_M;
}

export function latLngsToRing(latLngs) {
  return latLngs.map((ll) => [ll.lng, ll.lat]);
}

function normalizeRing(ring) {
  if (!ring?.length) return [];
  const first = ring[0];
  if (typeof first === "object" && !Array.isArray(first) && "lat" in first) {
    const coords = ring.map((p) => [p.lng, p.lat]);
    return closeRing(coords);
  }
  if (Array.isArray(first) && first.length >= 2) {
    const coords = ring.map((p) => {
      const lng = Math.abs(p[0]) <= 90 && Math.abs(p[1]) > 90 ? p[1] : p[0];
      const lat = Math.abs(p[0]) <= 90 && Math.abs(p[1]) > 90 ? p[0] : p[1];
      return [lng, lat];
    });
    return closeRing(coords);
  }
  return closeRing([]);
}

function closeRing(coords) {
  if (coords.length < 3) return coords;
  const [a0, a1] = coords[0];
  const [b0, b1] = coords[coords.length - 1];
  if (a0 === b0 && a1 === b1) return coords;
  return [...coords, [a0, a1]];
}

export { CLOSE_VERTEX_PX, DEFAULT_MAX_ZOOM };
