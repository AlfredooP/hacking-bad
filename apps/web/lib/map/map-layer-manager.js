import { L } from "./leaflet-map-factory.js";
import { focusZoneOnMap } from "../gis/geo-utils.js";

const ZONE_STYLES = {
  active: { color: "#38bdf8", fillColor: "#0ea5e9", fillOpacity: 0.15, weight: 2 },
  inactive: { color: "#64748b", fillColor: "#475569", fillOpacity: 0.1, weight: 2 },
  draft: { color: "#f59e0b", fillColor: "#fbbf24", fillOpacity: 0.2, weight: 2, dashArray: "6 4" },
};

/**
 * Centralized Leaflet layer groups for zones, routes, markers.
 */
export class MapLayerManager {
  /** @param {import("leaflet").Map} map */
  constructor(map) {
    this.map = map;
    this.groups = {
      zones: L.featureGroup().addTo(map),
      routes: L.featureGroup().addTo(map),
      containers: L.layerGroup().addTo(map),
      trucks: L.layerGroup().addTo(map),
    };
    this.containerMarkers = {};
    this.truckMarkers = {};
    this.routeGlow = null;
    this.routeLine = null;
    this.selectedZoneId = null;
  }

  /** @param {Array<object>} zones - API zone objects with geometry */
  setZones(zones = []) {
    this.groups.zones.clearLayers();
    zones.forEach((zone) => {
      if (!zone.geometry) return;
      const style = ZONE_STYLES[zone.status] || ZONE_STYLES.active;
      const layer = L.geoJSON(
        { type: "Feature", properties: { id: zone.id }, geometry: zone.geometry },
        {
          style: {
            ...style,
            ...(this.selectedZoneId === zone.id ? { weight: 3, fillOpacity: 0.25 } : {}),
          },
          onEachFeature: (feature, l) => {
            l.bindTooltip(zone.nombre || "Zona", { sticky: true });
          },
        }
      );
      layer.eachLayer((l) => this.groups.zones.addLayer(l));
    });
  }

  setSelectedZone(zoneId) {
    this.selectedZoneId = zoneId;
  }

  focusZone(zone) {
    if (zone?.geometry) {
      focusZoneOnMap(this.map, { type: "Feature", geometry: zone.geometry });
    }
  }

  /** @param {object|null} lineStringGeoJSON */
  setRoute(lineStringGeoJSON) {
    this.clearRoute();
    if (!lineStringGeoJSON?.coordinates?.length) return;

    const latLngs = lineStringGeoJSON.coordinates.map(([lng, lat]) => [lat, lng]);

    this.routeGlow = L.polyline(latLngs, {
      color: "#0ea5e9",
      weight: 12,
      opacity: 0.25,
      lineJoin: "round",
      lineCap: "round",
    }).addTo(this.groups.routes);

    this.routeLine = L.polyline(latLngs, {
      color: "#38bdf8",
      weight: 5,
      opacity: 0.85,
      lineJoin: "round",
      lineCap: "round",
    }).addTo(this.groups.routes);

    const bounds = this.routeLine.getBounds();
    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16, animate: true });
    }
  }

  clearRoute() {
    if (this.routeGlow) {
      this.groups.routes.removeLayer(this.routeGlow);
      this.routeGlow = null;
    }
    if (this.routeLine) {
      this.groups.routes.removeLayer(this.routeLine);
      this.routeLine = null;
    }
  }

  upsertContainerMarker(c, icon, popupHtml, onClick) {
    if (!c.latitud || !c.longitud) return null;
    const latLng = [c.latitud, c.longitud];
    let marker = this.containerMarkers[c.id];

    if (!marker) {
      marker = L.marker(latLng, { icon })
        .bindPopup(popupHtml, { maxWidth: 280, className: "dark-popup" })
        .addTo(this.groups.containers);
      marker.on("click", () => onClick?.(c));
      this.containerMarkers[c.id] = marker;
    } else {
      marker.setLatLng(latLng);
      marker.setIcon(icon);
      marker.setPopupContent(popupHtml);
    }
    return marker;
  }

  removeContainerMarker(id) {
    const m = this.containerMarkers[id];
    if (m) {
      this.groups.containers.removeLayer(m);
      delete this.containerMarkers[id];
    }
  }

  syncContainerMarkers(containers, buildMarker) {
    const ids = new Set(containers.map((c) => c.id));
    Object.keys(this.containerMarkers).forEach((id) => {
      if (!ids.has(parseInt(id, 10))) this.removeContainerMarker(parseInt(id, 10));
    });
    containers.forEach((c) => buildMarker(c));
  }

  upsertTruckMarker(t, icon, popupHtml) {
    if (!t.latitud || !t.longitud) return null;
    const latLng = [t.latitud, t.longitud];
    let marker = this.truckMarkers[t.id];
    if (!marker) {
      marker = L.marker(latLng, { icon })
        .bindPopup(popupHtml, { maxWidth: 260 })
        .addTo(this.groups.trucks);
      this.truckMarkers[t.id] = marker;
    } else {
      marker.setLatLng(latLng);
      marker.setPopupContent(popupHtml);
    }
    return marker;
  }

  removeTruckMarker(id) {
    const m = this.truckMarkers[id];
    if (m) {
      this.groups.trucks.removeLayer(m);
      delete this.truckMarkers[id];
    }
  }

  syncTruckMarkers(trucks, buildMarker) {
    const ids = new Set(trucks.map((t) => t.id));
    Object.keys(this.truckMarkers).forEach((id) => {
      if (!ids.has(parseInt(id, 10))) this.removeTruckMarker(parseInt(id, 10));
    });
    trucks.forEach((t) => buildMarker(t));
  }

  getTruckMarker(id) {
    return this.truckMarkers[id];
  }

  destroy() {
    this.clearRoute();
    Object.values(this.groups).forEach((g) => {
      g.clearLayers();
      this.map.removeLayer(g);
    });
    this.containerMarkers = {};
    this.truckMarkers = {};
  }
}
