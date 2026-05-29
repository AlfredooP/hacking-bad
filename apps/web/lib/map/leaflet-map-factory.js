import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";

const DEFAULT_CENTER = [25.533, -103.436];
const DEFAULT_ZOOM = 15.5;
const MAP_STATE_KEY = "bin_map_state";

/**
 * Create a Leaflet map with OSM tiles and optional persisted view.
 * @param {HTMLElement} container
 * @param {object} [options]
 * @returns {import("leaflet").Map}
 */
export function createLeafletMap(container, options = {}) {
  const saved = loadMapState();
  const center = options.center ?? saved?.center ?? DEFAULT_CENTER;
  const zoom = options.zoom ?? saved?.zoom ?? DEFAULT_ZOOM;

  const map = L.map(container, {
    center,
    zoom,
    zoomControl: false,
    ...options.mapOptions,
  });

  L.control.zoom({ position: "topright" }).addTo(map);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
    maxZoom: 19,
  }).addTo(map);

  map.on("moveend", () => {
    saveMapState(map);
  });

  return map;
}

/** @param {import("leaflet").Map} map */
export function saveMapState(map, extra = {}) {
  if (typeof sessionStorage === "undefined") return;
  const c = map.getCenter();
  sessionStorage.setItem(
    MAP_STATE_KEY,
    JSON.stringify({
      center: [c.lat, c.lng],
      zoom: map.getZoom(),
      ...extra,
    })
  );
}

export function loadMapState() {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(MAP_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function destroyLeafletMap(map) {
  if (!map) return;
  map.off();
  map.remove();
}

export { L, DEFAULT_CENTER, DEFAULT_ZOOM, MAP_STATE_KEY };
