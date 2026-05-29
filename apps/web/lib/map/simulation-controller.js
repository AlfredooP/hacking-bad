import { L } from "./leaflet-map-factory.js";

/**
 * Animates a truck along a route LineString and triggers container pickups.
 */
export class SimulationController {
  /**
   * @param {import("leaflet").Map} map
   * @param {import("./map-layer-manager.js").MapLayerManager} layerManager
   */
  constructor(map, layerManager) {
    this.map = map;
    this.layerManager = layerManager;
    this.simMarker = null;
    this._abort = false;
    this._timeouts = [];
  }

  stop() {
    this._abort = true;
    this._timeouts.forEach(clearTimeout);
    this._timeouts = [];
    if (this.simMarker) {
      this.map.removeLayer(this.simMarker);
      this.simMarker = null;
    }
  }

  /**
   * @param {object} params
   * @param {object} params.truck
   * @param {Array} params.orderedContainers
   * @param {object} params.geometry - GeoJSON LineString
   * @param {(step: string) => void} params.onStep
   * @param {(truckId: number) => Promise<void>} params.onTruckEnRoute
   * @param {(containerId: number) => Promise<number>} params.onPickup - returns weight collected
   * @param {(truckId: number, capacity: number) => Promise<void>} params.onComplete
   */
  async play({
    truck,
    orderedContainers,
    geometry,
    onStep,
    onTruckEnRoute,
    onPickup,
    onComplete,
  }) {
    this._abort = false;
    const coordinates = geometry.coordinates;
    const latLngs = coordinates.map(([lng, lat]) => L.latLng(lat, lng));

    const simIcon = L.divIcon({
      className: "",
      html: `<div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#059669,#10b981);border:3px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 0 20px rgba(16,185,129,0.5);animation:truck-pulse 1s ease-in-out infinite;">
        <svg style="width:24px;height:24px;color:#fff" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10M21 16V10a1 1 0 00-1-1h-7m8 7H13"/></svg></div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    this.simMarker = L.marker(latLngs[0], { icon: simIcon, zIndexOffset: 1000 }).addTo(this.map);

    const truckMarker = this.layerManager.getTruckMarker(truck.id);
    if (truckMarker?.getElement) {
      truckMarker.getElement().style.display = "none";
    }

    let stepIndex = 0;
    let currentCapacity =
      truck.capacidadDisponible ?? truck.capacidadMax ?? 1000;

    await onTruckEnRoute?.(truck.id);

    return new Promise((resolve) => {
      const schedule = (fn, ms) => {
        const id = setTimeout(fn, ms);
        this._timeouts.push(id);
      };

      const animate = () => {
        if (this._abort || stepIndex >= latLngs.length) {
          onStep?.("Simulación finalizada. Retornando a base.");
          schedule(async () => {
            this.stop();
            if (truckMarker?.getElement) {
              truckMarker.getElement().style.display = "block";
            }
            await onComplete?.(truck.id, currentCapacity);
            resolve({ capacity: currentCapacity });
          }, 1500);
          return;
        }

        const pos = latLngs[stepIndex];
        this.simMarker.setLatLng(pos);
        this.map.panTo(pos, { animate: true, duration: 0.15 });

        const visiting = orderedContainers.find(
          (c) =>
            Math.abs(c.longitud - pos.lng) < 0.0001 &&
            Math.abs(c.latitud - pos.lat) < 0.0001
        );

        if (visiting) {
          onStep?.(`Recolectando residuos en ${visiting.ubicacion || visiting.nombre}...`);
          schedule(async () => {
            const weight = await onPickup?.(visiting);
            if (typeof weight === "number") {
              currentCapacity = Math.max(0, currentCapacity - weight);
            }
            stepIndex++;
            animate();
          }, 1500);
        } else {
          onStep?.(`Camión ${truck.placa} en movimiento...`);
          stepIndex++;
          schedule(animate, 80);
        }
      };

      animate();
    });
  }
}
