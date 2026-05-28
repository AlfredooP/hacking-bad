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

export default function MapDashboard() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  // Data states
  const [containers, setContainers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [loading, setLoading] = useState(true);

  // Simulation states
  const [activeRoute, setActiveRoute] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationStep, setSimulationStep] = useState("");
  const [simulatedTruckPos, setSimulatedTruckPos] = useState(null);

  // Refs for tracking markers
  const containerMarkersRef = useRef({});
  const truckMarkersRef = useRef({});
  const simTruckMarkerRef = useRef(null);

  // Polling trigger
  const [tick, setTick] = useState(0);

  // 1. Fetch data periodically
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cRes, tRes] = await Promise.all([
          api.containersMap(),
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

    // Poll every 5 seconds for real-time updates
    const interval = setInterval(() => {
      fetchData();
    }, 5000);

    return () => clearInterval(interval);
  }, [tick]);

  // 2. Initialize Map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    // Center map around first container coordinate, or general area
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
          "line-width": 10,
          "line-opacity": 0.3,
        },
      });
    });

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // 3. Render and Update Container and Truck Markers Dynamically
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Check if map is loaded. If not, wait for "load" event.
    if (!map.isStyleLoaded()) {
      return;
    }

    // --- Containers Markers ---
    containers.forEach((c) => {
      if (!c.latitud || !c.longitud) return;

      const priority = c.ia?.prioridad || "baja";
      const vol = c.ia?.volumenPct != null ? Math.round(c.ia.volumenPct) : 0;
      const color = PRIORITY_COLORS[priority] || "#64748b";

      let marker = containerMarkersRef.current[c.id];

      if (!marker) {
        // Create custom HTML element for marker
        const el = document.createElement("div");
        el.className = "relative cursor-pointer transition-all hover:scale-125";
        el.style.width = "28px";
        el.style.height = "28px";

        // SVG container icon with glassmorphism glow
        el.innerHTML = `
          <div class="marker-pulse absolute -inset-1.5 rounded-full opacity-60 bg-${priority === "alta" ? "red" : priority === "media" ? "amber" : "green"}-500 blur-sm ${vol >= 80 ? "animate-ping" : ""}"></div>
          <div class="relative w-full h-full rounded-full flex items-center justify-center border-2 border-white shadow-lg" style="background: ${color};">
            <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
        `;

        el.addEventListener("click", () => {
          setSelectedContainer(c);
        });

        const popup = new maplibregl.Popup({ offset: 15 }).setHTML(`
          <div class="p-2 text-slate-800 font-sans">
            <h4 class="font-bold text-sm border-b border-slate-200 pb-1 mb-1">${c.ubicacion || "Contenedor"}</h4>
            <div class="text-xs space-y-1">
              <p><strong>Tipo:</strong> ${c.tipoResiduo || "Sin definir"}</p>
              <p><strong>Nivel Llenado:</strong> ${vol}%</p>
              <p><strong>Prioridad:</strong> <span class="capitalize px-1.5 py-0.5 rounded text-[10px] text-white" style="background: ${color};">${priority}</span></p>
              <p><strong>Estado:</strong> ${c.estado || "—"}</p>
            </div>
          </div>
        `);

        marker = new maplibregl.Marker({ element: el })
          .setLngLat([c.longitud, c.latitud])
          .setPopup(popup)
          .addTo(map);

        containerMarkersRef.current[c.id] = marker;
      } else {
        // Update existing marker details
        marker.setLngLat([c.longitud, c.latitud]);
        const el = marker.getElement();
        const pulse = el.querySelector(".marker-pulse");
        const badge = el.querySelector(".relative");

        if (pulse) {
          pulse.className = `marker-pulse absolute -inset-1.5 rounded-full opacity-60 bg-${priority === "alta" ? "red" : priority === "media" ? "amber" : "green"}-500 blur-sm ${vol >= 80 ? "animate-ping" : ""}`;
        }
        if (badge) {
          badge.style.background = color;
        }

        const popup = marker.getPopup();
        if (popup) {
          popup.setHTML(`
            <div class="p-2 text-slate-800 font-sans">
              <h4 class="font-bold text-sm border-b border-slate-200 pb-1 mb-1">${c.ubicacion || "Contenedor"}</h4>
              <div class="text-xs space-y-1">
                <p><strong>Tipo:</strong> ${c.tipoResiduo || "Sin definir"}</p>
                <p><strong>Nivel Llenado:</strong> ${vol}%</p>
                <p><strong>Prioridad:</strong> <span class="capitalize px-1.5 py-0.5 rounded text-[10px] text-white" style="background: ${color};">${priority}</span></p>
                <p><strong>Estado:</strong> ${c.estado || "—"}</p>
              </div>
            </div>
          `);
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

    // --- Trucks Markers ---
    trucks.forEach((t) => {
      if (!t.latitud || !t.longitud) return;

      let marker = truckMarkersRef.current[t.id];

      if (!marker) {
        const el = document.createElement("div");
        el.className = "cursor-pointer transition-transform hover:scale-125";
        el.style.width = "32px";
        el.style.height = "32px";
        el.innerHTML = `
          <div class="w-full h-full rounded-full bg-sky-600 border-2 border-white flex items-center justify-center shadow-md">
            <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10M21 16V10a1 1 0 00-1-1h-7m8 7H13" />
            </svg>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 15 }).setHTML(`
          <div class="p-2 text-slate-800 font-sans">
            <h4 class="font-bold text-sm border-b border-slate-200 pb-1 mb-1">Camión ${t.placa}</h4>
            <div class="text-xs space-y-1">
              <p><strong>Estado:</strong> ${t.estado}</p>
              <p><strong>Carga Disp:</strong> ${t.capacidadDisponible}kg / ${t.capacidadMax}kg</p>
              <p><strong>Residuos:</strong> ${t.tipoResiduos || "Cualquiera"}</p>
            </div>
          </div>
        `);

        marker = new maplibregl.Marker({ element: el })
          .setLngLat([t.longitud, t.latitud])
          .setPopup(popup)
          .addTo(map);

        truckMarkersRef.current[t.id] = marker;
      } else {
        marker.setLngLat([t.longitud, t.latitud]);
        const popup = marker.getPopup();
        if (popup) {
          popup.setHTML(`
            <div class="p-2 text-slate-800 font-sans">
              <h4 class="font-bold text-sm border-b border-slate-200 pb-1 mb-1">Camión ${t.placa}</h4>
              <div class="text-xs space-y-1">
                <p><strong>Estado:</strong> ${t.estado}</p>
                <p><strong>Carga Disp:</strong> ${t.capacidadDisponible}kg / ${t.capacidadMax}kg</p>
                <p><strong>Residuos:</strong> ${t.tipoResiduos || "Cualquiera"}</p>
              </div>
            </div>
          `);
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
  }, [containers, trucks]);

  // 4. AI Route Optimization Trigger
  const handleOptimizeRoute = async () => {
    try {
      setLoading(true);
      const res = await api.aiOptimizeRoute();
      if (!res.route || res.route.length === 0) {
        alert("La IA determinó que no hay contenedores críticos que necesiten recolección o no hay camiones disponibles.");
        return;
      }

      // Find the truck and container coordinates
      const selectedTruck = trucks.find((t) => t.id === res.truckId);
      if (!selectedTruck) return;

      const orderedContainers = res.route
        .map((id) => containers.find((c) => c.id === id))
        .filter(Boolean);

      const points = [
        [selectedTruck.longitud, selectedTruck.latitud],
        ...orderedContainers.map((c) => [c.longitud, c.latitud]),
        [selectedTruck.longitud, selectedTruck.latitud], // Return to base
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
        // Fallback directly to straight lines
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

        // Fit map bounds to show entire route
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

    // Create Simulated Truck Marker
    const simTruckEl = document.createElement("div");
    simTruckEl.style.width = "40px";
    simTruckEl.style.height = "40px";
    simTruckEl.innerHTML = `
      <div class="relative w-full h-full rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-xl animate-pulse">
        <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10M21 16V10a1 1 0 00-1-1h-7m8 7H13" />
        </svg>
      </div>
    `;

    const simMarker = new maplibregl.Marker({ element: simTruckEl })
      .setLngLat(coordinates[0])
      .addTo(map);

    simTruckMarkerRef.current = simMarker;

    // Temporarily hide actual truck marker to avoid duplicates
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
        // Simulation completed!
        setSimulationStep("Simulación finalizada. Retornando a base.");
        setTimeout(async () => {
          // Remove simulated marker
          simMarker.remove();
          simTruckMarkerRef.current = null;

          // Restore normal truck marker
          if (truckMarkersRef.current[truck.id]) {
            truckMarkersRef.current[truck.id].getElement().style.display = "block";
          }

          // Update truck capacity in database
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
          setTick((t) => t + 1); // Refresh map data
          alert("¡Recolección completada con éxito! La ruta ha sido procesada.");
        }, 1500);
        return;
      }

      const currentPos = coordinates[stepIndex];
      simMarker.setLngLat(currentPos);
      map.setCenter(currentPos);

      // Check if truck is currently visiting a container
      const visitingContainer = orderedContainers.find(
        (c) =>
          Math.abs(c.longitud - currentPos[0]) < 0.0001 &&
          Math.abs(c.latitud - currentPos[1]) < 0.0001
      );

      if (visitingContainer) {
        setSimulationStep(`Recolectando residuos en ${visitingContainer.ubicacion}...`);
        
        // Wait 1.5 seconds at the container to simulate emptying process
        setTimeout(async () => {
          try {
            // Send emptying request to backend! This makes it reflect in database!
            await api.containerUpdate(visitingContainer.id, { empty: true });

            // Calculate collected weight (volume % * avg container volume of 150L/kg)
            const weightCollected = Math.round(((visitingContainer.ia?.volumenPct ?? 0) / 100.0) * 150.0);
            currentCapacityAvailable = Math.max(0, currentCapacityAvailable - weightCollected);

            // Temporarily empty it in local state
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
        // Move to next point in 100ms
        stepIndex++;
        setTimeout(animateTruck, 80);
      }
    };

    // Set truck status to 'En Ruta' in backend
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
    <div className="relative h-[calc(100vh-8rem)] w-full flex overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
      {/* Map container (100% of workspace) */}
      <div ref={mapRef} className="absolute inset-0 z-10 w-full h-full" />

      {/* Real-time stats header overlay */}
      <div className="absolute top-4 left-4 z-20 flex gap-2">
        <div className="px-4 py-2 bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-xl shadow-lg flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-slate-300">Monitoreo en Tiempo Real</span>
        </div>

        {isSimulating && (
          <div className="px-4 py-2 bg-emerald-950/90 backdrop-blur-md border border-emerald-500/50 rounded-xl shadow-lg flex items-center gap-3 animate-pulse">
            <svg className="w-4 h-4 text-emerald-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-xs font-semibold text-emerald-400">{simulationStep}</span>
          </div>
        )}
      </div>

      {/* Floating Interactive Panel */}
      <aside className="absolute right-4 top-4 bottom-4 w-80 z-20 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-xl shadow-2xl p-4 flex flex-col justify-between overflow-y-auto">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white tracking-wide">Gestión Inteligente</h3>
            <p className="text-slate-400 text-xs mt-0.5">Control de residuos optimizado por IA</p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2 bg-slate-800/60 rounded-lg border border-slate-750">
              <span className="text-slate-400 text-[10px] block font-medium">Contenedores</span>
              <span className="text-lg font-bold text-white">{containers.length}</span>
            </div>
            <div className="p-2 bg-slate-800/60 rounded-lg border border-slate-750">
              <span className="text-slate-400 text-[10px] block font-medium">Camiones Activos</span>
              <span className="text-lg font-bold text-sky-400">
                {trucks.filter((t) => t.estado === "Disponible").length}/{trucks.length}
              </span>
            </div>
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
                <svg className="w-4 h-4 text-emerald-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl space-y-3 relative animate-fadeIn">
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
                  <span className="text-slate-400">Ubicación:</span>
                  <span className="font-semibold text-white">{selectedContainer.ubicacion}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">Tipo Residuo:</span>
                  <span className="font-semibold text-green-400">{selectedContainer.tipoResiduo || "Sin definir"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">Estado:</span>
                  <span className="font-semibold text-white">{selectedContainer.estado || "—"}</span>
                </div>

                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Nivel de Llenado:</span>
                    <span className="font-bold text-white">
                      {selectedContainer.ia?.volumenPct != null ? Math.round(selectedContainer.ia.volumenPct) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${selectedContainer.ia?.volumenPct || 0}%`,
                        backgroundColor: PRIORITY_COLORS[selectedContainer.ia?.prioridad || "baja"],
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

        <div className="pt-4 border-t border-slate-800 text-[10px] text-slate-500 text-center flex justify-between">
          <span>Actualizado automáticamente</span>
          <button onClick={() => setTick((t) => t + 1)} className="hover:text-white underline">
            Refrescar ahora
          </button>
        </div>
      </aside>
    </div>
  );
}
