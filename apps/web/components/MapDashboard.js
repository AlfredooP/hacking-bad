"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { api } from "@/lib/api-client";

const PRIORITY_COLORS = {
  alta: "#ef4444",
  media: "#f59e0b",
  baja: "#22c55e",
};

// Inject marker CSS keyframes once
const MARKER_STYLES_ID = "map-marker-styles";
function injectMarkerStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(MARKER_STYLES_ID)) return;

  const style = document.createElement("style");
  style.id = MARKER_STYLES_ID;
  style.textContent = `
    @keyframes marker-ping {
      0% { transform: scale(1); opacity: 0.6; }
      75%, 100% { transform: scale(1.8); opacity: 0; }
    }
    @keyframes marker-pulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 0.3; }
    }
    @keyframes truck-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    .maplibregl-popup-content {
      background: #1e293b !important;
      border: 1px solid #475569 !important;
      border-radius: 12px !important;
      padding: 0 !important;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5) !important;
      color: #e2e8f0 !important;
    }
    .maplibregl-popup-tip {
      border-top-color: #1e293b !important;
    }
    .maplibregl-popup-close-button {
      color: #94a3b8 !important;
      font-size: 18px !important;
      padding: 4px 8px !important;
    }
    .maplibregl-popup-close-button:hover {
      color: #fff !important;
      background: transparent !important;
    }
  `;
  document.head.appendChild(style);
}

function createContainerMarkerEl(color, priority, vol) {
  const el = document.createElement("div");
  // MapLibre usa transform en este nodo raíz para posicionar el marcador; no aplicar scale aquí.
  el.style.cssText = "width:36px;height:36px;cursor:pointer;";

  const inner = document.createElement("div");
  inner.style.cssText =
    "position:relative;width:100%;height:100%;transition:transform 0.2s ease;transform-origin:center center;";

  inner.addEventListener("mouseenter", () => { inner.style.transform = "scale(1.25)"; });
  inner.addEventListener("mouseleave", () => { inner.style.transform = "scale(1)"; });

  // Pulse ring (solo decorativo)
  const pulse = document.createElement("div");
  pulse.className = "marker-pulse-ring";
  pulse.style.cssText = `
    position:absolute;inset:-4px;border-radius:50%;opacity:0.6;pointer-events:none;
    background:${color};filter:blur(4px);
    animation:${vol >= 80 ? "marker-ping 1.5s cubic-bezier(0,0,0.2,1) infinite" : "marker-pulse 2s ease-in-out infinite"};
  `;
  inner.appendChild(pulse);

  // Icon circle
  const badge = document.createElement("div");
  badge.className = "marker-badge";
  badge.style.cssText = `
    position:relative;width:100%;height:100%;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    border:2.5px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.4);
    background:${color};
  `;
  badge.innerHTML = `
    <svg style="width:18px;height:18px;color:#fff;pointer-events:none;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  `;
  inner.appendChild(badge);
  el.appendChild(inner);

  return el;
}

function createTruckMarkerEl() {
  const el = document.createElement("div");
  el.style.cssText = "cursor:pointer;width:38px;height:38px;";

  const inner = document.createElement("div");
  inner.style.cssText =
    "width:100%;height:100%;transition:transform 0.2s ease;transform-origin:center center;";

  inner.addEventListener("mouseenter", () => { inner.style.transform = "scale(1.25)"; });
  inner.addEventListener("mouseleave", () => { inner.style.transform = "scale(1)"; });

  const circle = document.createElement("div");
  circle.style.cssText = `
    width:100%;height:100%;border-radius:50%;
    background:linear-gradient(135deg,#0284c7,#0ea5e9);
    border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;
    box-shadow:0 4px 12px rgba(14,165,233,0.35);
  `;
  circle.innerHTML = `
    <svg style="width:20px;height:20px;color:#fff;pointer-events:none;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10M21 16V10a1 1 0 00-1-1h-7m8 7H13" />
    </svg>
  `;
  inner.appendChild(circle);
  el.appendChild(inner);
  return el;
}

function containerPopupHTML(c, color, priority, vol) {
  const inferido = c.ia?.tipoResiduoInferido;
  const contaminacion = c.ia?.contaminacionDetectada;
  return `
    <div style="padding:14px 16px;font-family:system-ui,-apple-system,sans-serif;">
      <h4 style="font-weight:700;font-size:14px;color:#f1f5f9;border-bottom:1px solid #334155;padding-bottom:8px;margin:0 0 10px 0;">
        ${c.nombre || c.ubicacion || "Contenedor"}
      </h4>
      ${contaminacion ? `<div style="background:#7f1d1d;color:#fecaca;padding:6px 8px;border-radius:6px;font-size:10px;margin-bottom:8px;">⚠ ${c.ia?.mensajeContaminacion || "Contaminación detectada"}</div>` : ""}
      <div style="display:flex;flex-direction:column;gap:6px;font-size:12px;">
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#94a3b8;">Esperado:</span>
          <span style="color:#22c55e;font-weight:600;">${c.tipoResiduo || "Sin definir"}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#94a3b8;">Inferido (IA):</span>
          <span style="color:#38bdf8;font-weight:600;">${inferido || "Sin datos"}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#94a3b8;">Zona:</span>
          <span style="color:#f1f5f9;font-weight:600;">${c.zona || "—"}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#94a3b8;">Nivel Llenado:</span>
          <span style="color:#f1f5f9;font-weight:600;">${vol}%</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#94a3b8;">Prioridad:</span>
          <span style="background:${color};color:#fff;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;text-transform:capitalize;">${priority}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#94a3b8;">Estado:</span>
          <span style="color:#f1f5f9;font-weight:600;">${c.estado || "—"} (${c.estadoOperativo || "Activo"})</span>
        </div>
        <div style="margin-top:6px;">
          <div style="width:100%;background:#0f172a;border-radius:4px;height:6px;overflow:hidden;">
            <div style="width:${vol}%;height:100%;border-radius:4px;background:${color};transition:width 0.3s;"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function truckPopupHTML(t) {
  const statusColor = t.estado === "Disponible" ? "#22c55e" : t.estado === "En Ruta" ? "#f59e0b" : "#ef4444";
  return `
    <div style="padding:14px 16px;font-family:system-ui,-apple-system,sans-serif;">
      <h4 style="font-weight:700;font-size:14px;color:#f1f5f9;border-bottom:1px solid #334155;padding-bottom:8px;margin:0 0 10px 0;">
        Camión ${t.placa}
      </h4>
      <div style="display:flex;flex-direction:column;gap:6px;font-size:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#94a3b8;">Estado:</span>
          <span style="background:${statusColor};color:#fff;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;">${t.estado}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#94a3b8;">Carga Disp:</span>
          <span style="color:#f1f5f9;font-weight:600;">${t.capacidadDisponible}kg / ${t.capacidadMax}kg</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#94a3b8;">Residuos:</span>
          <span style="color:#38bdf8;font-weight:600;">${t.tipoResiduos || "Cualquiera"}</span>
        </div>
      </div>
    </div>
  `;
}

const WASTE_FILTER_OPTIONS = [
  "", "Orgánicos", "Inorgánicos", "Reciclables", "Plástico", "Papel/Cartón", "Vidrio/Metal",
];

export default function MapDashboard() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  // Data states
  const [containers, setContainers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filtros del mapa
  const [filterTipo, setFilterTipo] = useState("");
  const [filterPrioridad, setFilterPrioridad] = useState("");
  const [filterSoloContaminacion, setFilterSoloContaminacion] = useState(false);

  // Simulation states
  const [activeRoute, setActiveRoute] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationStep, setSimulationStep] = useState("");
  const [simulatedTruckPos, setSimulatedTruckPos] = useState(null);

  // Refs for tracking markers
  const containerMarkersRef = useRef({});
  const truckMarkersRef = useRef({});
  const simTruckMarkerRef = useRef(null);
  const containersRef = useRef([]);

  // Polling trigger
  const [tick, setTick] = useState(0);

  containersRef.current = containers;

  // Inject marker CSS on mount
  useEffect(() => {
    injectMarkerStyles();
  }, []);

  // 1. Fetch data periodically
  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = {};
        if (filterTipo) params.tipoResiduo = filterTipo;
        if (filterPrioridad) params.prioridad = filterPrioridad;
        if (filterSoloContaminacion) params.soloContaminacion = true;

        const [cRes, tRes] = await Promise.all([
          api.containersMap(params),
          api.trucksList(),
        ]);
        setContainers(cRes.containers || []);
        setTrucks(tRes.trucks || []);
      } catch (e) {
        console.error("Error fetching map dashboard data:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const interval = setInterval(() => {
      fetchData();
    }, 5000);

    return () => clearInterval(interval);
  }, [tick, filterTipo, filterPrioridad, filterSoloContaminacion]);

  // 2. Initialize Map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const center = [-103.436, 25.533];

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center,
      zoom: 15.5,
      transformRequest: (url, resourceType) => {
        if (resourceType === "Tile" && url.includes("openstreetmap.org")) {
          return {
            url,
            headers: { "User-Agent": "BIN-NEXT/1.0 (local-dev)" },
          };
        }
        return { url };
      },
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapInstance.current = map;

    map.on("load", () => {
      // Create empty route layer
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [] },
        },
      });

      map.addLayer({
        id: "route-glow",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#0ea5e9",
          "line-width": 12,
          "line-opacity": 0.25,
        },
      });

      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#38bdf8",
          "line-width": 5,
          "line-opacity": 0.85,
        },
      });

      setMapReady(true);
    });

    return () => {
      map.remove();
      mapInstance.current = null;
      setMapReady(false);
    };
  }, []);

  // 3. Render and Update Container and Truck Markers Dynamically
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    if (!mapReady || !map.isStyleLoaded()) {
      return;
    }

    // --- Container Markers ---
    containers.forEach((c) => {
      if (!c.latitud || !c.longitud) return;

      const priority = c.ia?.prioridadEfectiva || c.ia?.prioridad || "baja";
      const vol = c.ia?.volumenPct != null ? Math.round(c.ia.volumenPct) : 0;
      const color = c.ia?.contaminacionDetectada
        ? "#dc2626"
        : PRIORITY_COLORS[priority] || "#64748b";

      let marker = containerMarkersRef.current[c.id];

      if (!marker) {
        const el = createContainerMarkerEl(color, priority, vol);
        el.dataset.containerId = String(c.id);

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          const id = parseInt(el.dataset.containerId, 10);
          const container = containersRef.current.find((item) => item.id === id);
          if (container) setSelectedContainer(container);
        });

        const popup = new maplibregl.Popup({ offset: 20, closeButton: true, maxWidth: "260px" })
          .setHTML(containerPopupHTML(c, color, priority, vol));

        marker = new maplibregl.Marker({ element: el })
          .setLngLat([c.longitud, c.latitud])
          .setPopup(popup)
          .addTo(map);

        containerMarkersRef.current[c.id] = marker;
      } else {
        // Update existing marker
        marker.setLngLat([c.longitud, c.latitud]);
        const el = marker.getElement();

        // Update pulse ring
        const pulseRing = el.querySelector(".marker-pulse-ring");
        if (pulseRing) {
          pulseRing.style.background = color;
          pulseRing.style.animation = vol >= 80
            ? "marker-ping 1.5s cubic-bezier(0,0,0.2,1) infinite"
            : "marker-pulse 2s ease-in-out infinite";
        }

        // Update badge color
        const badge = el.querySelector(".marker-badge");
        if (badge) {
          badge.style.background = color;
        }
        const popup = marker.getPopup();
        if (popup) {
          popup.setHTML(containerPopupHTML(c, color, priority, vol));
        }
      }
    });

    // Remove deleted container markers
    Object.keys(containerMarkersRef.current).forEach((id) => {
      if (!containers.find((c) => c.id === parseInt(id))) {
        containerMarkersRef.current[id].remove();
        delete containerMarkersRef.current[id];
      }
    });

    // --- Truck Markers ---
    trucks.forEach((t) => {
      if (!t.latitud || !t.longitud) return;

      let marker = truckMarkersRef.current[t.id];

      if (!marker) {
        const el = createTruckMarkerEl();

        const popup = new maplibregl.Popup({ offset: 20, closeButton: true, maxWidth: "260px" })
          .setHTML(truckPopupHTML(t));

        marker = new maplibregl.Marker({ element: el })
          .setLngLat([t.longitud, t.latitud])
          .setPopup(popup)
          .addTo(map);

        truckMarkersRef.current[t.id] = marker;
      } else {
        marker.setLngLat([t.longitud, t.latitud]);
        const popup = marker.getPopup();
        if (popup) {
          popup.setHTML(truckPopupHTML(t));
        }
      }
    });

    // Remove deleted truck markers
    Object.keys(truckMarkersRef.current).forEach((id) => {
      if (!trucks.find((t) => t.id === parseInt(id))) {
        truckMarkersRef.current[id].remove();
        delete truckMarkersRef.current[id];
      }
    });
  }, [containers, trucks, mapReady]);

  // 4. AI Route Optimization Trigger
  const handleOptimizeRoute = async () => {
    try {
      setLoading(true);
      const res = await api.aiOptimizeRoute();
      if (!res.route || res.route.length === 0) {
        alert("La IA determinó que no hay contenedores críticos que necesiten recolección o no hay camiones disponibles.");
        return;
      }

      const selectedTruck = trucks.find((t) => t.id === res.truckId);
      if (!selectedTruck) return;

      const orderedContainers = res.route
        .map((id) => containers.find((c) => c.id === id))
        .filter(Boolean);

      const points = [
        [selectedTruck.longitud, selectedTruck.latitud],
        ...orderedContainers.map((c) => [c.longitud, c.latitud]),
        [selectedTruck.longitud, selectedTruck.latitud],
      ];

      // Fetch road geometries from OSRM
      let routeGeojson = null;
      try {
        const coordinatesString = points.map((p) => `${p[0]},${p[1]}`).join(";");
        const osrmRes = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${coordinatesString}?geometries=geojson&overview=full`
        );
        const osrmData = await osrmRes.json();
        if (osrmData.routes && osrmData.routes[0]) {
          routeGeojson = osrmData.routes[0].geometry;
        }
      } catch (err) {
        console.warn("OSRM routing failed, using point-to-point line fallback:", err);
      }

      if (!routeGeojson) {
        routeGeojson = {
          type: "LineString",
          coordinates: points,
        };
      }

      // Display the route line on map
      const map = mapInstance.current;
      if (map && map.getSource("route")) {
        map.getSource("route").setData({
          type: "Feature",
          properties: {},
          geometry: routeGeojson,
        });

        const coordinates = routeGeojson.coordinates;
        const bounds = coordinates.reduce(
          (acc, coord) => acc.extend(coord),
          new maplibregl.LngLatBounds(coordinates[0], coordinates[0])
        );
        map.fitBounds(bounds, { padding: 50 });
      }

      setActiveRoute({
        truck: selectedTruck,
        containers: orderedContainers,
        geometry: routeGeojson,
        metrics: res.metrics,
      });
    } catch (e) {
      alert("Error al optimizar ruta: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // 5. Intelligent Simulation Runner
  const handleStartSimulation = async () => {
    if (!activeRoute) return;

    setIsSimulating(true);
    const map = mapInstance.current;
    const { truck, containers: orderedContainers, geometry } = activeRoute;
    const coordinates = geometry.coordinates;

    // Create Simulated Truck Marker with inline styles
    const simTruckEl = document.createElement("div");
    simTruckEl.style.cssText = "width:44px;height:44px;";

    const simCircle = document.createElement("div");
    simCircle.style.cssText = `
      position:relative;width:100%;height:100%;border-radius:50%;
      background:linear-gradient(135deg,#059669,#10b981);
      border:3px solid #fff;display:flex;align-items:center;justify-content:center;
      box-shadow:0 0 20px rgba(16,185,129,0.5);
      animation:truck-pulse 1s ease-in-out infinite;
    `;
    simCircle.innerHTML = `
      <svg style="width:24px;height:24px;color:#fff;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10M21 16V10a1 1 0 00-1-1h-7m8 7H13" />
      </svg>
    `;
    simTruckEl.appendChild(simCircle);

    const simMarker = new maplibregl.Marker({ element: simTruckEl })
      .setLngLat(coordinates[0])
      .addTo(map);

    simTruckMarkerRef.current = simMarker;

    // Hide actual truck marker
    if (truckMarkersRef.current[truck.id]) {
      truckMarkersRef.current[truck.id].getElement().style.display = "none";
    }

    // Step-by-step animation along the coordinate path
    let stepIndex = 0;
    const totalSteps = coordinates.length;
    let truckCapacity = truck.capacidadMax || 1000;
    let currentCapacityAvailable = truck.capacidadDisponible ?? truckCapacity;

    const animateTruck = () => {
      if (stepIndex >= totalSteps) {
        setSimulationStep("Simulación finalizada. Retornando a base.");
        setTimeout(async () => {
          simMarker.remove();
          simTruckMarkerRef.current = null;

          if (truckMarkersRef.current[truck.id]) {
            truckMarkersRef.current[truck.id].getElement().style.display = "block";
          }

          try {
            await api.truckUpdate(truck.id, {
              capacidadDisponible: currentCapacityAvailable,
              estado: "Disponible",
            });
          } catch (e) {
            console.error("Error saving final truck capacity:", e);
          }

          setIsSimulating(false);
          setActiveRoute(null);
          setTick((t) => t + 1);
          alert("¡Recolección completada con éxito! La ruta ha sido procesada.");
        }, 1500);
        return;
      }

      const currentPos = coordinates[stepIndex];
      simMarker.setLngLat(currentPos);
      map.setCenter(currentPos);

      const visitingContainer = orderedContainers.find(
        (c) =>
          Math.abs(c.longitud - currentPos[0]) < 0.0001 &&
          Math.abs(c.latitud - currentPos[1]) < 0.0001
      );

      if (visitingContainer) {
        setSimulationStep(`Recolectando residuos en ${visitingContainer.ubicacion}...`);

        setTimeout(async () => {
          try {
            await api.containerUpdate(visitingContainer.id, { empty: true });

            const weightCollected = Math.round(((visitingContainer.ia?.volumenPct ?? 0) / 100.0) * 150.0);
            currentCapacityAvailable = Math.max(0, currentCapacityAvailable - weightCollected);

            setContainers((prev) =>
              prev.map((c) =>
                c.id === visitingContainer.id
                  ? { ...c, estado: "Vacío", ia: { ...c.ia, volumenPct: 0, prioridad: "baja" } }
                  : c
              )
            );
          } catch (e) {
            console.error("Error emptying container:", e);
          }

          stepIndex++;
          animateTruck();
        }, 1500);
      } else {
        setSimulationStep(`Camión ${truck.placa} en movimiento...`);
        stepIndex++;
        setTimeout(animateTruck, 80);
      }
    };

    try {
      await api.truckUpdate(truck.id, { estado: "En Ruta" });
    } catch (e) {
      console.error(e);
    }

    animateTruck();
  };

  // Clear route
  const handleClearRoute = () => {
    setActiveRoute(null);
    const map = mapInstance.current;
    if (map && map.getSource("route")) {
      map.getSource("route").setData({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: [] },
      });
    }
  };

  return (
    <div className="relative w-full flex overflow-hidden rounded-xl border border-slate-700 bg-slate-950" style={{ height: "calc(100vh - 8rem)" }}>
      {/* Map container */}
      <div ref={mapRef} style={{ position: "absolute", inset: 0, zIndex: 10, width: "100%", height: "100%" }} />

      {/* Real-time stats header overlay */}
      <div style={{ position: "absolute", top: 16, left: 16, zIndex: 20, display: "flex", gap: 8 }}>
        <div className="px-4 py-2 bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-xl shadow-lg flex items-center gap-3">
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", animation: "marker-pulse 2s ease-in-out infinite" }} />
          <span className="text-xs font-semibold text-slate-300">Monitoreo en Tiempo Real</span>
        </div>

        {isSimulating && (
          <div className="px-4 py-2 bg-emerald-950/90 backdrop-blur-md border border-emerald-500/50 rounded-xl shadow-lg flex items-center gap-3" style={{ animation: "truck-pulse 1s ease-in-out infinite" }}>
            <svg className="w-4 h-4 text-emerald-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-xs font-semibold text-emerald-400">{simulationStep}</span>
          </div>
        )}
      </div>

      {/* Floating Interactive Panel */}
      <aside className="absolute right-4 top-4 bottom-4 w-80 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-xl shadow-2xl p-4 flex flex-col justify-between overflow-y-auto" style={{ zIndex: 20 }}>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white tracking-wide">Gestión Inteligente</h3>
            <p className="text-slate-400 text-xs mt-0.5">Control de residuos optimizado por IA</p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2 bg-slate-800/60 rounded-lg border border-slate-700">
              <span className="text-slate-400 block font-medium" style={{ fontSize: 10 }}>Contenedores</span>
              <span className="text-lg font-bold text-white">{containers.length}</span>
            </div>
            <div className="p-2 bg-slate-800/60 rounded-lg border border-slate-700">
              <span className="text-slate-400 block font-medium" style={{ fontSize: 10 }}>Camiones Activos</span>
              <span className="text-lg font-bold text-sky-400">
                {trucks.filter((t) => t.estado === "Disponible").length}/{trucks.length}
              </span>
            </div>
          </div>

          {/* Filtros */}
          <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/30 space-y-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Filtros</h4>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="input w-full text-xs py-1.5"
            >
              <option value="">Todos los residuos</option>
              {WASTE_FILTER_OPTIONS.filter(Boolean).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={filterPrioridad}
              onChange={(e) => setFilterPrioridad(e.target.value)}
              className="input w-full text-xs py-1.5"
            >
              <option value="">Todas las prioridades</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={filterSoloContaminacion}
                onChange={(e) => setFilterSoloContaminacion(e.target.checked)}
                className="rounded"
              />
              Solo contaminación
            </label>
          </div>

          {/* Route Optimization Box */}
          <div className="p-3.5 bg-slate-800/40 rounded-xl border border-slate-700/30 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Optimización de Ruta</h4>

            {!activeRoute ? (
              <button
                disabled={isSimulating || loading}
                onClick={handleOptimizeRoute}
                className="w-full btn-primary py-2 text-xs flex items-center justify-center gap-2"
              >
                <svg style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Calcular Ruta con IA
              </button>
            ) : (
              <div className="space-y-3">
                <div className="p-2.5 bg-slate-900/60 rounded-lg space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Camión Asignado:</span>
                    <span className="font-semibold text-sky-400">{activeRoute.truck.placa}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Contenedores:</span>
                    <span className="font-semibold text-white">{activeRoute.metrics.totalContainers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Llenado Promedio:</span>
                    <span className="font-semibold text-amber-400">{activeRoute.metrics.urgencyScore}%</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleClearRoute}
                    disabled={isSimulating}
                    className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs border border-slate-700 font-medium"
                  >
                    Limpiar
                  </button>
                  <button
                    onClick={handleStartSimulation}
                    disabled={isSimulating}
                    className="flex-1 btn-primary py-2 text-xs font-bold"
                  >
                    Iniciar Simulación
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Selected container summary */}
          {selectedContainer ? (
            <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl space-y-3 relative">
              <div className="flex justify-between items-start">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Detalle de Contenedor</h4>
                <button
                  onClick={() => setSelectedContainer(null)}
                  className="text-slate-500 hover:text-white text-xs"
                >
                  Cerrar
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">Nombre:</span>
                  <span className="font-semibold text-white">{selectedContainer.nombre || selectedContainer.ubicacion}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">Esperado:</span>
                  <span className="font-semibold text-green-400">{selectedContainer.tipoResiduo || "Sin definir"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">Inferido (IA):</span>
                  <span className="font-semibold text-sky-400">{selectedContainer.ia?.tipoResiduoInferido || "Sin datos"}</span>
                </div>
                {selectedContainer.ia?.contaminacionDetectada && (
                  <div className="p-2 bg-rose-950/50 border border-rose-500/30 rounded-lg text-rose-300 text-[11px]">
                    {selectedContainer.ia.mensajeContaminacion}
                  </div>
                )}
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">Zona:</span>
                  <span className="font-semibold text-white">{selectedContainer.zona || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">Estado:</span>
                  <span className="font-semibold text-white">{selectedContainer.estado || "—"}</span>
                </div>

                <div className="space-y-1 pt-1">
                  <div className="flex justify-between" style={{ fontSize: 11 }}>
                    <span className="text-slate-400">Nivel de Llenado:</span>
                    <span className="font-bold text-white">
                      {selectedContainer.ia?.volumenPct != null ? Math.round(selectedContainer.ia.volumenPct) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full overflow-hidden" style={{ height: 6 }}>
                    <div
                      className="rounded-full"
                      style={{
                        height: "100%",
                        width: `${selectedContainer.ia?.volumenPct || 0}%`,
                        backgroundColor: PRIORITY_COLORS[selectedContainer.ia?.prioridadEfectiva || selectedContainer.ia?.prioridad || "baja"],
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center p-6 border border-dashed border-slate-800 rounded-xl">
              <p className="text-xs text-slate-500">Haz clic en un contenedor en el mapa para ver su información en tiempo real.</p>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-slate-800 text-center flex justify-between" style={{ fontSize: 10, color: "#64748b" }}>
          <span>Actualizado automáticamente</span>
          <button onClick={() => setTick((t) => t + 1)} className="hover:text-white underline" style={{ color: "inherit" }}>
            Refrescar ahora
          </button>
        </div>
      </aside>
    </div>
  );
}
