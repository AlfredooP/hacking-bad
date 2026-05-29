import { L } from "./leaflet-map-factory.js";
import {
  calculatePolygonAreaSqM,
  calculatePolygonCenter,
  isDuplicateVertex,
  isNearFirstVertex,
  toGeoJSONPolygon,
  validatePolygon,
} from "../gis/geo-utils.js";

function createVertexMarker(latlng, { isFirst = false, closeable = false } = {}) {
  const size = isFirst ? 18 : 14;
  const color = isFirst ? "#38bdf8" : "#0ea5e9";
  const innerClass = closeable
    ? "zone-vertex-inner zone-vertex-closeable"
    : "zone-vertex-inner";

  return L.marker(latlng, {
    icon: L.divIcon({
      className: "zone-vertex-icon",
      html: `<div class="${innerClass}" style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 6px rgba(0,0,0,0.35);"></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    }),
    interactive: true,
    zIndexOffset: 1000,
  });
}

/**
 * Polygon drawing state machine for operational zones.
 * States: idle | drawing | preview | completed | cancelled
 */
export class ZoneDrawController {
  constructor(map, callbacks = {}) {
    this.map = map;
    this.onComplete = callbacks.onComplete;
    this.onStateChange = callbacks.onStateChange;
    this.onError = callbacks.onError;

    this.state = "idle";
    this.vertices = [];
    this._tempGroup = L.featureGroup().addTo(map);
    this._vertexMarkers = [];
    this._previewLine = null;
    this._rubberLine = null;
    this._tooltip = null;
    this._handlers = null;
    this._dblClickGrace = false;
    this._ignoreNextClick = false;
  }

  getState() {
    return this.state;
  }

  _setState(next) {
    this.state = next;
    this.onStateChange?.(next);
  }

  startDrawing() {
    if (this.state === "drawing") return;
    this.cleanup(false);
    this._setState("drawing");
    this.vertices = [];
    this.map.dragging.disable();
    this.map.doubleClickZoom.disable();
    this.map.getContainer().classList.add("map-drawing-mode");
    this._attachHandlers();
    this._updateTooltip("Clic para añadir punto");
  }

  undoVertex() {
    if (this.state !== "drawing" || this.vertices.length === 0) return;
    this.vertices.pop();
    const vm = this._vertexMarkers.pop();
    if (vm) this._tempGroup.removeLayer(vm);
    this._updateFirstVertexCloseable();
    this._refreshPreview();
    this._updateTooltip(
      this.vertices.length >= 3
        ? "Clic en el primer punto para cerrar"
        : "Clic para añadir punto"
    );
  }

  finishDrawing() {
    if (this.state !== "drawing") return;
    this._tryClose(true);
  }

  cancelDrawing() {
    this._setState("cancelled");
    this.cleanup();
    this._setState("idle");
  }

  _attachHandlers() {
    this._handlers = {
      click: (e) => this._onMapClick(e),
      dblclick: (e) => this._onMapDblClick(e),
      mousemove: (e) => this._onMouseMove(e),
      keydown: (e) => this._onKeyDown(e),
    };
    this.map.on("click", this._handlers.click);
    this.map.on("dblclick", this._handlers.dblclick);
    this.map.on("mousemove", this._handlers.mousemove);
    document.addEventListener("keydown", this._handlers.keydown);
  }

  _detachHandlers() {
    if (!this._handlers) return;
    this.map.off("click", this._handlers.click);
    this.map.off("dblclick", this._handlers.dblclick);
    this.map.off("mousemove", this._handlers.mousemove);
    document.removeEventListener("keydown", this._handlers.keydown);
    this._handlers = null;
  }

  _onKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      this.cancelDrawing();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && this.state === "drawing") {
      e.preventDefault();
      this.undoVertex();
    }
  }

  _onMapClick(e) {
    if (this.state !== "drawing" || this._dblClickGrace || this._ignoreNextClick) {
      this._ignoreNextClick = false;
      return;
    }

    const latlng = L.latLng(e.latlng.lat, e.latlng.lng);

    if (
      this.vertices.length >= 3 &&
      isNearFirstVertex(this.map, latlng, this.vertices[0])
    ) {
      this._tryClose(false);
      return;
    }

    if (isDuplicateVertex(this.vertices, latlng)) return;

    this.vertices.push(latlng);
    const isFirst = this.vertices.length === 1;
    const closeable = this.vertices.length >= 3;
    const marker = createVertexMarker(latlng, { isFirst, closeable });
    marker.on("click", (ev) => {
      L.DomEvent.stopPropagation(ev);
      if (this.state === "drawing" && this.vertices.length >= 3) {
        this._tryClose(false);
      }
    });
    marker.addTo(this._tempGroup);
    this._vertexMarkers.push(marker);

    if (this.vertices.length >= 3) {
      this._updateFirstVertexCloseable();
      this._updateTooltip("Clic en el primer punto para cerrar");
    }

    this._refreshPreview();
  }

  _updateFirstVertexCloseable() {
    if (this._vertexMarkers.length === 0) return;
    const first = this.vertices[0];
    const closeable = this.vertices.length >= 3;
    this._tempGroup.removeLayer(this._vertexMarkers[0]);
    const marker = createVertexMarker(first, { isFirst: true, closeable });
    marker.on("click", (ev) => {
      L.DomEvent.stopPropagation(ev);
      if (this.state === "drawing" && this.vertices.length >= 3) {
        this._tryClose(false);
      }
    });
    marker.addTo(this._tempGroup);
    this._vertexMarkers[0] = marker;
  }

  _onMapDblClick(e) {
    L.DomEvent.stopPropagation(e);
    L.DomEvent.preventDefault(e);
    this._dblClickGrace = true;
    this._ignoreNextClick = true;
    setTimeout(() => {
      this._dblClickGrace = false;
    }, 400);
    if (this.state === "drawing") this._tryClose(true);
  }

  _onMouseMove(e) {
    if (this.state !== "drawing" || this.vertices.length === 0) return;
    const cursor = L.latLng(e.latlng.lat, e.latlng.lng);
    const pts = [...this.vertices, cursor];
    if (this._rubberLine) this._tempGroup.removeLayer(this._rubberLine);
    this._rubberLine = L.polyline(pts, {
      color: "#38bdf8",
      weight: 2,
      opacity: 0.6,
      dashArray: "4 6",
      interactive: false,
    }).addTo(this._tempGroup);
  }

  _tryClose(fromButton) {
    if (this.vertices.length < 3) {
      this.onError?.("Se requieren al menos 3 vértices para crear una zona.");
      return;
    }

    const ring = this.vertices.map((v) => ({ lat: v.lat, lng: v.lng }));
    const validation = validatePolygon(ring);
    if (!validation.valid) {
      this.onError?.(validation.error || "Polígono inválido.");
      return;
    }

    this._detachHandlers();

    const geometry = toGeoJSONPolygon(ring);
    const center = calculatePolygonCenter(ring, "centroid");
    const areaSqM = calculatePolygonAreaSqM(validation.ring);

    const draft = {
      geometry,
      centroid: center,
      areaSqM,
      latLngs: ring,
    };

    this.onComplete?.(draft);
    this.cleanup();
    this._setState("idle");
  }

  _refreshPreview() {
    if (this._previewLine) this._tempGroup.removeLayer(this._previewLine);
    if (this.vertices.length >= 2) {
      this._previewLine = L.polyline(this.vertices, {
        color: "#38bdf8",
        weight: 3,
        opacity: 0.9,
        interactive: false,
      }).addTo(this._tempGroup);
    }
    if (this._rubberLine) {
      this._tempGroup.removeLayer(this._rubberLine);
      this._rubberLine = null;
    }
  }

  _updateTooltip(text) {
    if (!this._tooltip) {
      this._tooltip = L.tooltip({
        permanent: true,
        direction: "top",
        className: "zone-draw-tooltip",
        offset: [0, -12],
      });
    }
    const anchor = this.vertices[this.vertices.length - 1] || this.map.getCenter();
    this._tooltip.setLatLng(anchor).setContent(text).addTo(this.map);
  }

  cleanup(resetState = true) {
    this._detachHandlers();
    this._tempGroup.clearLayers();
    this._vertexMarkers = [];
    this._previewLine = null;
    this._rubberLine = null;
    if (this._tooltip) {
      this.map.removeLayer(this._tooltip);
      this._tooltip = null;
    }
    this.vertices = [];
    this.map.dragging.enable();
    this.map.doubleClickZoom.enable();
    this.map.getContainer().classList.remove("map-drawing-mode");
    if (resetState && this.state !== "idle") this._setState("idle");
  }

  destroy() {
    this.cleanup();
    this.map.removeLayer(this._tempGroup);
  }
}
