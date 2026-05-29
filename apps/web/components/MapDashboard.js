"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import {
  createLeafletMap,
  destroyLeafletMap,
  saveMapState,
  loadMapState,
} from "@/lib/map/leaflet-map-factory";
import { MapLayerManager } from "@/lib/map/map-layer-manager";
import { ZoneDrawController } from "@/lib/map/zone-draw-controller";
import { SimulationController } from "@/lib/map/simulation-controller";
import {
  injectMapStyles,
  createContainerIcon,
  createTruckIcon,
  containerPopupHTML,
  truckPopupHTML,
  getContainerColor,
} from "@/lib/map/marker-factory";
import { focusZoneOnMap } from "@/lib/gis/geo-utils";
import {
  listRegions,
  listZones,
  listZoneCatalog,
  createZone,
  setRegionZones,
} from "@/lib/services/zones-service";
import {
  buildActiveRoute,
  optimizeGlobalRoute,
  simulateZoneRoute,
  simulateRegionRoutes,
} from "@/lib/services/simulation-service";

const WASTE_FILTER_OPTIONS = [
  "",
  "Orgánicos",
  "Inorgánicos",
  "Reciclables",
  "Plástico",
  "Papel/Cartón",
  "Vidrio/Metal",
];

function CollapsibleHeader({ title, isOpen, onToggle, count }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between p-2.5 bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700 text-xs font-bold text-white transition-all focus:outline-none cursor-pointer"
    >
      <div className="flex items-center gap-2">
        <span>{title}</span>
        {count !== undefined && (
          <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-slate-750 text-slate-300">
            {count}
          </span>
        )}
      </div>
      <svg
        className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
          isOpen ? "rotate-180" : ""
        }`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

export default function MapDashboard({ canManage = false }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layerManagerRef = useRef(null);
  const drawControllerRef = useRef(null);
  const simControllerRef = useRef(null);

  const [containers, setContainers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [zones, setZones] = useState([]);
  const [zoneCatalog, setZoneCatalog] = useState([]);
  const [regions, setRegions] = useState([]);
  const [regionZoneIds, setRegionZoneIds] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState(
    () => loadMapState()?.selectedRegionId ?? ""
  );
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [viewMode, setViewMode] = useState("region"); // "region" or "zone"
  const [showZonePolygons, setShowZonePolygons] = useState(true);
  const [selectedZoneDetail, setSelectedZoneDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drawingState, setDrawingState] = useState("idle");
  const [drawError, setDrawError] = useState("");

  const [filterTipo, setFilterTipo] = useState("");
  const [filterPrioridad, setFilterPrioridad] = useState("");
  const [filterSoloContaminacion, setFilterSoloContaminacion] = useState(false);

  const [activeRoute, setActiveRoute] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationStep, setSimulationStep] = useState("");

  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [zoneDraft, setZoneDraft] = useState(null);
  const [zoneName, setZoneName] = useState("");
  const [newRegionName, setNewRegionName] = useState("");

  const [tick, setTick] = useState(0);

  // 4 Collapsible sections state
  const [sections, setSections] = useState({
    containers: true,
    trucks: false,
    zones: false,
    regions: false,
  });

  const toggleSection = (sec) => {
    setSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  // Adding elements directly on the map
  const [addingMode, setAddingMode] = useState("idle"); // "idle", "container", "truck"
  const addingModeRef = useRef("idle");
  const [clickedLatLng, setClickedLatLng] = useState(null);

  // Forms
  const [containerModalOpen, setContainerModalOpen] = useState(false);
  const [containerForm, setContainerForm] = useState({
    nombre: "",
    ubicacion: "",
    capacidadMax: 200,
    tipoResiduo: "Orgánicos",
    idZone: "",
    prioridadConfigurada: "baja",
  });

  const [truckModalOpen, setTruckModalOpen] = useState(false);
  const [truckForm, setTruckForm] = useState({
    placa: "",
    capacidadMax: 1000,
    estado: "Disponible",
    tipoResiduos: ["Orgánicos"],
    idRegion: "",
  });

  const updateAddingMode = (mode) => {
    setAddingMode(mode);
    addingModeRef.current = mode;
    if (mode !== "idle" && drawingState === "drawing") {
      drawControllerRef.current?.cancelDrawing();
    }
  };

  const refreshZoneCatalog = useCallback(async () => {
    try {
      const catalog = await listZoneCatalog();
      setZoneCatalog(catalog);
    } catch (e) {
      console.error("Error loading zone catalog:", e);
    }
  }, []);

  const refreshZones = useCallback(async () => {
    try {
      if (!selectedRegionId) {
        setZones([]);
        setRegionZoneIds([]);
        return;
      }
      const z = await listZones(selectedRegionId);
      setZones(z);
      setRegionZoneIds(z.map((x) => x.id));
    } catch (e) {
      console.error("Error loading zones:", e);
    }
  }, [selectedRegionId]);

  const refreshRegions = useCallback(async () => {
    try {
      const r = await listRegions();
      setRegions(r);
      if (!selectedRegionId && r.length > 0) {
        setSelectedRegionId(r[0].id);
      }
    } catch (e) {
      console.error("Error loading regions:", e);
    }
  }, [selectedRegionId]);

  useEffect(() => {
    injectMapStyles();
  }, []);

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
        console.error("Error fetching map data:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [tick, filterTipo, filterPrioridad, filterSoloContaminacion]);

  useEffect(() => {
    refreshRegions();
  }, [refreshRegions, tick]);

  useEffect(() => {
    refreshZoneCatalog();
  }, [refreshZoneCatalog, tick]);

  useEffect(() => {
    refreshZones();
  }, [refreshZones, tick]);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = createLeafletMap(mapRef.current);
    mapInstance.current = map;
    layerManagerRef.current = new MapLayerManager(map);
    simControllerRef.current = new SimulationController(map, layerManagerRef.current);

    drawControllerRef.current = new ZoneDrawController(map, {
      onStateChange: setDrawingState,
      onError: (msg) => setDrawError(msg),
      onComplete: (draft) => {
        setZoneDraft(draft);
        setZoneName("");
        setZoneModalOpen(true);
        setDrawError("");
      },
    });

    // Map click listener for placing containers/trucks
    map.on("click", (e) => {
      const mode = addingModeRef.current;
      if (mode === "container" || mode === "truck") {
        setClickedLatLng({ lat: e.latlng.lat, lng: e.latlng.lng });
        if (mode === "container") {
          setContainerForm({
            nombre: "",
            ubicacion: "",
            capacidadMax: 200,
            tipoResiduo: "Orgánicos",
            idZone: "",
            prioridadConfigurada: "baja",
          });
          setContainerModalOpen(true);
        } else {
          setTruckForm({
            placa: "",
            capacidadMax: 1000,
            estado: "Disponible",
            tipoResiduos: ["Orgánicos"],
            idRegion: selectedRegionId || "",
          });
          setTruckModalOpen(true);
        }
        updateAddingMode("idle");
      }
    });

    setMapReady(true);

    return () => {
      drawControllerRef.current?.destroy();
      simControllerRef.current?.stop();
      layerManagerRef.current?.destroy();
      destroyLeafletMap(map);
      mapInstance.current = null;
      layerManagerRef.current = null;
      drawControllerRef.current = null;
      simControllerRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Helper to parse assigned vehicles from zones list
  const getTruckIdsForZones = useCallback((zonesList) => {
    const ids = new Set();
    for (const z of zonesList) {
      if (z.assignedVehicleIds) {
        try {
          const parsed = typeof z.assignedVehicleIds === "string"
            ? JSON.parse(z.assignedVehicleIds)
            : z.assignedVehicleIds;
          if (Array.isArray(parsed)) {
            parsed.forEach((id) => ids.add(Number(id)));
          }
        } catch (e) {
          console.error("Error parsing assignedVehicleIds:", e);
        }
      }
    }
    return Array.from(ids);
  }, []);

  const visibleZones = useMemo(() => {
    if (viewMode === "region") {
      return zones;
    } else {
      const activeZone = zoneCatalog.find((z) => z.id === selectedZoneId);
      return activeZone ? [activeZone] : [];
    }
  }, [viewMode, zones, zoneCatalog, selectedZoneId]);

  const visibleContainers = useMemo(() => {
    if (viewMode === "region") {
      if (!selectedRegionId) {
        // If no region is selected, show unassigned containers so the map isn't completely empty
        return containers.filter((c) => !c.idZone);
      }
      const zoneIds = zones.map((z) => z.id);
      return containers.filter((c) => !c.idZone || zoneIds.includes(c.idZone));
    } else {
      // viewMode === "zone"
      if (!selectedZoneId) return [];
      return containers.filter((c) => c.idZone === selectedZoneId);
    }
  }, [viewMode, containers, selectedRegionId, selectedZoneId, zones]);

  const visibleTrucks = useMemo(() => {
    const withCoords = trucks.filter(
      (t) => t.latitud != null && t.longitud != null && !Number.isNaN(Number(t.latitud))
    );

    let targetRegionId = "";
    if (viewMode === "region") {
      targetRegionId = selectedRegionId;
    } else {
      const activeZone = zoneCatalog.find((z) => z.id === selectedZoneId);
      targetRegionId = activeZone?.idRegion ?? "";
    }

    if (!targetRegionId) return withCoords;

    return withCoords.filter(
      (t) => t.idRegion === targetRegionId || t.idRegion == null || t.idRegion === ""
    );
  }, [viewMode, trucks, selectedRegionId, selectedZoneId, zoneCatalog]);

  const selectedRegionSummary = useMemo(() => {
    if (!selectedRegionId) return null;
    const region = regions.find((r) => r.id === selectedRegionId);
    const regionZones = zones.filter((z) => z.idRegion === selectedRegionId || regionZoneIds.includes(z.id));
    const regionContainers = visibleContainers;
    const avgVol =
      regionContainers.length > 0
        ? Math.round(
            regionContainers.reduce((s, c) => s + (c.ia?.volumenPct ?? 0), 0) / regionContainers.length
          )
        : 0;
    const contamination = regionContainers.filter((c) => c.ia?.contaminacionDetectada).length;
    return {
      region,
      zoneCount: regionZones.length,
      containerCount: regionContainers.length,
      truckCount: visibleTrucks.length,
      avgVol,
      contamination,
    };
  }, [selectedRegionId, regions, zones, regionZoneIds, visibleContainers, visibleTrucks]);

  useEffect(() => {
    if (!mapReady || !layerManagerRef.current) return;
    const lm = layerManagerRef.current;

    lm.syncContainerMarkers(visibleContainers, (c) => {
      const priority = c.ia?.prioridadEfectiva || c.ia?.prioridad || "baja";
      const vol = c.ia?.volumenPct != null ? Math.round(c.ia.volumenPct) : 0;
      const color = getContainerColor(c);
      lm.upsertContainerMarker(
        c,
        createContainerIcon(color, vol),
        containerPopupHTML(c, color, priority, vol),
        setSelectedContainer
      );
    });

    lm.syncTruckMarkers(visibleTrucks, (t) => {
      lm.upsertTruckMarker(t, createTruckIcon(), truckPopupHTML(t));
    });
  }, [visibleContainers, visibleTrucks, mapReady]);

  useEffect(() => {
    if (!layerManagerRef.current) return;
    layerManagerRef.current.setSelectedZone(selectedZoneId);
    const zonesToDraw = viewMode === "region" && !showZonePolygons ? [] : visibleZones;
    layerManagerRef.current.setZones(zonesToDraw, {
      onZoneClick: (zone) => {
        setSelectedZoneDetail(zone);
        setSelectedZoneId(zone.id);
        if (viewMode === "region") {
          layerManagerRef.current?.focusZone(zone);
        }
      },
    });
  }, [visibleZones, selectedZoneId, showZonePolygons, viewMode]);

  useEffect(() => {
    if (mapInstance.current && selectedRegionId) {
      saveMapState(mapInstance.current, { selectedRegionId });
    }
  }, [selectedRegionId]);

  const handleStartDraw = () => {
    updateAddingMode("idle");
    setDrawError("");
    drawControllerRef.current?.startDrawing();
  };

  const handleSaveZone = async () => {
    if (!zoneDraft || !zoneName.trim()) return;
    try {
      setLoading(true);
      const created = await createZone({
        idRegion: selectedRegionId || null,
        nombre: zoneName.trim(),
        status: "active",
        geometry: zoneDraft.geometry,
        assignContainers: true,
      });
      setZoneModalOpen(false);
      setZoneDraft(null);
      await refreshZoneCatalog();
      await refreshZones();
      if (created?.geometry) {
        focusZoneOnMap(mapInstance.current, created.geometry);
      } else {
        focusZoneOnMap(mapInstance.current, zoneDraft.geometry);
      }
    } catch (e) {
      alert("Error al guardar zona: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveContainer = async () => {
    if (!clickedLatLng || !containerForm.nombre.trim()) return;
    try {
      setLoading(true);
      const selectedZoneObj = zoneCatalog.find((z) => z.id === containerForm.idZone);
      const zoneNameString = selectedZoneObj ? selectedZoneObj.nombre : "";

      await api.containerCreate({
        nombre: containerForm.nombre.trim(),
        ubicacion: containerForm.ubicacion.trim(),
        zona: zoneNameString,
        idZone: containerForm.idZone || null,
        latitud: clickedLatLng.lat,
        longitud: clickedLatLng.lng,
        capacidad: `${containerForm.capacidadMax}L`,
        capacidadMax: Number(containerForm.capacidadMax),
        estado: "Vacío",
        estadoOperativo: "Activo",
        tipoResiduo: containerForm.tipoResiduo,
        prioridadConfigurada: containerForm.prioridadConfigurada,
      });

      setContainerModalOpen(false);
      setClickedLatLng(null);
      setTick((t) => t + 1);
    } catch (e) {
      alert("Error al guardar contenedor: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTruck = async () => {
    if (!clickedLatLng || !truckForm.placa.trim() || truckForm.tipoResiduos.length === 0) return;
    try {
      setLoading(true);
      await api.truckCreate({
        placa: truckForm.placa.trim(),
        capacidad: `${truckForm.capacidadMax}kg`,
        capacidadMax: Number(truckForm.capacidadMax),
        capacidadDisponible: Number(truckForm.capacidadMax),
        estado: truckForm.estado,
        latitud: clickedLatLng.lat,
        longitud: clickedLatLng.lng,
        tipoResiduos: truckForm.tipoResiduos.join(","),
        idRegion: truckForm.idRegion || selectedRegionId || null,
      });

      setTruckModalOpen(false);
      setClickedLatLng(null);
      setTick((t) => t + 1);
    } catch (e) {
      alert("Error al guardar camión: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContainer = async (e, id) => {
    e.stopPropagation();
    if (!confirm("¿Está seguro de que desea eliminar este contenedor?")) return;
    try {
      setLoading(true);
      await api.containerDelete(id);
      setSelectedContainer(null);
      setTick((t) => t + 1);
    } catch (e) {
      alert("Error al eliminar contenedor: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTruck = async (e, id) => {
    e.stopPropagation();
    if (!confirm("¿Está seguro de que desea eliminar este camión?")) return;
    try {
      setLoading(true);
      await api.truckDelete(id);
      setTick((t) => t + 1);
    } catch (e) {
      alert("Error al eliminar camión: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteZone = async (e, id) => {
    e.stopPropagation();
    if (!confirm("¿Está seguro de que desea eliminar esta zona del catálogo? Las relaciones se limpiarán.")) return;
    try {
      setLoading(true);
      await api.zoneDelete(id);
      if (selectedZoneId === id) setSelectedZoneId(null);
      await refreshZoneCatalog();
      await refreshZones();
      setTick((t) => t + 1);
    } catch (e) {
      alert("Error al eliminar zona: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRegion = async (id) => {
    if (!id) return;
    if (!confirm("¿Está seguro de que desea eliminar esta región? Las zonas quedarán en el catálogo.")) return;
    try {
      setLoading(true);
      await api.regionDelete(id);
      setSelectedRegionId("");
      await refreshRegions();
      setTick((t) => t + 1);
    } catch (e) {
      alert("Error al eliminar región: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleCatalogZoneInRegion = (zoneId) => {
    if (!selectedRegionId) return;
    setRegionZoneIds((prev) =>
      prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId]
    );
  };

  const handleSaveRegionZones = async () => {
    if (!selectedRegionId) return;
    try {
      setLoading(true);
      await setRegionZones(selectedRegionId, regionZoneIds);
      await refreshZoneCatalog();
      await refreshZones();
    } catch (e) {
      alert("Error al asignar zonas: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRegion = async () => {
    if (!newRegionName.trim()) return;
    try {
      const r = await api.regionCreate({ nombre: newRegionName.trim() });
      setNewRegionName("");
      setSelectedRegionId(r.id);
      await refreshRegions();
    } catch (e) {
      alert("Error al crear región: " + e.message);
    }
  };

  const runOptimize = async (optimizer) => {
    try {
      setLoading(true);
      const res = await optimizer();
      const routeList = res.routes;
      if (routeList) {
        const firstWithRoute = routeList.find((r) => r.route?.length > 0);
        if (!firstWithRoute) {
          alert("No hay contenedores para optimizar en las zonas de esta región.");
          return;
        }
        const merged = {
          truckId: firstWithRoute.truckId,
          route: firstWithRoute.route,
          metrics: firstWithRoute.metrics,
          scope: "region",
          regionId: res.regionId,
        };
        const active = await buildActiveRoute(merged, trucks, containers);
        if (active) {
          layerManagerRef.current?.setRoute(active.geometry);
          setActiveRoute(active);
        }
        return;
      }

      if (!res.route?.length) {
        alert(
          "La IA determinó que no hay contenedores críticos o no hay camiones disponibles."
        );
        return;
      }
      const active = await buildActiveRoute(res, trucks, containers);
      if (active) {
        layerManagerRef.current?.setRoute(active.geometry);
        setActiveRoute(active);
      }
    } catch (e) {
      alert("Error al optimizar ruta: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOptimizeRoute = () => runOptimize(() => optimizeGlobalRoute());
  const handleOptimizeZone = () => {
    if (!selectedZoneId) {
      alert("Selecciona una zona en la lista.");
      return;
    }
    runOptimize(() => simulateZoneRoute(selectedZoneId));
  };
  const handleOptimizeRegion = () => {
    if (!selectedRegionId) {
      alert("Selecciona una región.");
      return;
    }
    runOptimize(() => simulateRegionRoutes(selectedRegionId));
  };

  const handleStartSimulation = async () => {
    if (!activeRoute || !simControllerRef.current) return;
    setIsSimulating(true);
    const { truck, containers: orderedContainers, geometry } = activeRoute;

    try {
      await simControllerRef.current.play({
        truck,
        orderedContainers,
        geometry,
        onStep: setSimulationStep,
        onTruckEnRoute: (id) => api.truckUpdate(id, { estado: "En Ruta" }),
        onPickup: async (c) => {
          await api.containerUpdate(c.id, { empty: true });
          const weight = Math.round(((c.ia?.volumenPct ?? 0) / 100) * 150);
          setContainers((prev) =>
            prev.map((item) =>
              item.id === c.id
                ? {
                    ...item,
                    estado: "Vacío",
                    ia: { ...item.ia, volumenPct: 0, prioridad: "baja" },
                  }
                : item
            )
          );
          return weight;
        },
        onComplete: async (id, capacity) => {
          await api.truckUpdate(id, {
            capacidadDisponible: capacity,
            estado: "Disponible",
          });
          setIsSimulating(false);
          setActiveRoute(null);
          layerManagerRef.current?.clearRoute();
          setTick((t) => t + 1);
        },
      });
    } catch (e) {
      console.error(e);
      setIsSimulating(false);
    }
  };

  const handleClearRoute = () => {
    simControllerRef.current?.stop();
    setActiveRoute(null);
    layerManagerRef.current?.clearRoute();
  };

  const isDrawing = drawingState === "drawing";

  return (
    <div
      className="relative w-full flex overflow-hidden rounded-xl border border-slate-700 bg-slate-950"
      style={{ height: "calc(100vh - 8rem)" }}
    >
      <div
        ref={mapRef}
        style={{ position: "absolute", inset: 0, zIndex: 10, width: "100%", height: "100%" }}
      />

      <div style={{ position: "absolute", top: 16, left: 16, zIndex: 20, display: "flex", gap: 8 }}>
        <div className="px-4 py-2 bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-xl shadow-lg flex items-center gap-3">
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#22c55e",
              animation: "marker-pulse 2s ease-in-out infinite",
            }}
          />
          <span className="text-xs font-semibold text-slate-300">Monitoreo en Tiempo Real</span>
        </div>
        {isSimulating && (
          <div className="px-4 py-2 bg-emerald-950/90 backdrop-blur-md border border-emerald-500/50 rounded-xl shadow-lg flex items-center gap-3">
            <span className="text-xs font-semibold text-emerald-400">{simulationStep}</span>
          </div>
        )}
      </div>

      {/* Adding banner hint overlay */}
      {addingMode !== "idle" && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 px-6 py-3 bg-sky-950/95 backdrop-blur-md border border-sky-500/50 rounded-full shadow-2xl flex items-center gap-4 animate-bounce">
          <div className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
          <span className="text-sm font-semibold text-sky-200">
            Haga clic en el mapa para colocar el {addingMode === "container" ? "contenedor" : "camión"}
          </span>
          <button
            type="button"
            onClick={() => updateAddingMode("idle")}
            className="px-3 py-1 bg-sky-900 hover:bg-sky-800 text-white rounded-full text-xs font-bold transition-all border border-sky-700 cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Zone save modal */}
      {zoneModalOpen && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-85 shadow-2xl">
            <h3 className="text-white font-bold mb-2">Guardar zona en catálogo</h3>
            <p className="text-xs text-slate-400 mb-1">
              Área: {zoneDraft?.areaSqM ? (zoneDraft.areaSqM / 10000).toFixed(2) : "—"} ha
            </p>
            {selectedRegionId ? (
              <p className="text-[10px] text-sky-400/90 mb-3">Se asignará a la región actual.</p>
            ) : (
              <p className="text-[10px] text-slate-500 mb-3">
                Quedará en el catálogo; asígnala a una región después.
              </p>
            )}
            <input
              className="input w-full mb-4"
              placeholder="Nombre de la zona"
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 px-3 py-2 bg-slate-800 text-white rounded-lg text-sm border border-slate-750 hover:bg-slate-750"
                onClick={() => {
                  setZoneModalOpen(false);
                  setZoneDraft(null);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!zoneName.trim() || loading}
                className="flex-1 btn-primary py-2 text-sm"
                onClick={handleSaveZone}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Container creation modal */}
      {containerModalOpen && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-96 shadow-2xl space-y-4">
            <div>
              <h3 className="text-white font-bold text-lg">Agregar Contenedor en el Mapa</h3>
              <p className="text-xs text-slate-400 mt-1">
                Coordenadas: {clickedLatLng?.lat?.toFixed(6)}, {clickedLatLng?.lng?.toFixed(6)}
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Nombre / Identificador</label>
                <input
                  className="input w-full"
                  placeholder="Ej: Contenedor A"
                  value={containerForm.nombre}
                  onChange={(e) => setContainerForm(prev => ({ ...prev, nombre: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Ubicación</label>
                <input
                  className="input w-full"
                  placeholder="Ej: Edificio Central, Planta Baja"
                  value={containerForm.ubicacion}
                  onChange={(e) => setContainerForm(prev => ({ ...prev, ubicacion: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Capacidad Max (L)</label>
                  <input
                    type="number"
                    className="input w-full"
                    value={containerForm.capacidadMax}
                    onChange={(e) => setContainerForm(prev => ({ ...prev, capacidadMax: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Prioridad Inicial</label>
                  <select
                    className="input w-full"
                    value={containerForm.prioridadConfigurada}
                    onChange={(e) => setContainerForm(prev => ({ ...prev, prioridadConfigurada: e.target.value }))}
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Tipo de Residuo</label>
                  <select
                    className="input w-full"
                    value={containerForm.tipoResiduo}
                    onChange={(e) => setContainerForm(prev => ({ ...prev, tipoResiduo: e.target.value }))}
                  >
                    {WASTE_FILTER_OPTIONS.filter(Boolean).map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Zona</label>
                  <select
                    className="input w-full"
                    value={containerForm.idZone}
                    onChange={(e) => setContainerForm(prev => ({ ...prev, idZone: e.target.value }))}
                  >
                    <option value="">— Sin Zona —</option>
                    {zoneCatalog.map(z => (
                      <option key={z.id} value={z.id}>{z.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                className="flex-1 px-3 py-2 bg-slate-800 text-white rounded-lg text-sm border border-slate-700 hover:bg-slate-700"
                onClick={() => setContainerModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!containerForm.nombre.trim() || loading}
                className="flex-1 btn-primary py-2 text-sm font-bold"
                onClick={handleSaveContainer}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Truck creation modal */}
      {truckModalOpen && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-96 shadow-2xl space-y-4">
            <div>
              <h3 className="text-white font-bold text-lg">Registrar Camión en el Mapa</h3>
              <p className="text-xs text-slate-400 mt-1">
                Coordenadas: {clickedLatLng?.lat?.toFixed(6)}, {clickedLatLng?.lng?.toFixed(6)}
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Placa / Identificador</label>
                <input
                  className="input w-full"
                  placeholder="Ej: TRK-999"
                  value={truckForm.placa}
                  onChange={(e) => setTruckForm(prev => ({ ...prev, placa: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Región de Operación</label>
                <select
                  className="input w-full"
                  value={truckForm.idRegion}
                  onChange={(e) => setTruckForm(prev => ({ ...prev, idRegion: e.target.value }))}
                >
                  <option value="">— Sin Región —</option>
                  {regions.map(r => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Capacidad Max (kg)</label>
                  <input
                    type="number"
                    className="input w-full"
                    value={truckForm.capacidadMax}
                    onChange={(e) => setTruckForm(prev => ({ ...prev, capacidadMax: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Estado</label>
                  <select
                    className="input w-full"
                    value={truckForm.estado}
                    onChange={(e) => setTruckForm(prev => ({ ...prev, estado: e.target.value }))}
                  >
                    <option value="Disponible">Disponible</option>
                    <option value="En Ruta">En Ruta</option>
                    <option value="Mantenimiento">Mantenimiento</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Tipos de Residuo Compatibles</label>
                <div className="grid grid-cols-2 gap-2 mt-1 max-h-32 overflow-y-auto p-1 border border-slate-800 rounded bg-slate-950/40">
                  {["Orgánicos", "Inorgánicos", "Reciclables", "Químicos", "Metales pesados", "Residuos especiales"].map(cat => {
                    const isSelected = truckForm.tipoResiduos.includes(cat);
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => {
                          setTruckForm(prev => {
                            const current = prev.tipoResiduos;
                            const next = current.includes(cat)
                              ? current.filter(x => x !== cat)
                              : [...current, cat];
                            return { ...prev, tipoResiduos: next };
                          });
                        }}
                        className={`p-1.5 rounded text-[10px] font-medium text-left border transition-all truncate cursor-pointer ${
                          isSelected
                            ? "bg-green-500/20 text-green-400 border-green-500"
                            : "bg-slate-800 text-slate-450 border-slate-700 hover:border-slate-500"
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                className="flex-1 px-3 py-2 bg-slate-800 text-white rounded-lg text-sm border border-slate-700 hover:bg-slate-700"
                onClick={() => setTruckModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!truckForm.placa.trim() || truckForm.tipoResiduos.length === 0 || loading}
                className="flex-1 btn-primary py-2 text-sm font-bold"
                onClick={handleSaveTruck}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      <aside
        className="absolute right-4 top-4 bottom-4 w-85 bg-slate-900/90 backdrop-blur-md border border-slate-750 rounded-xl shadow-2xl p-4 flex flex-col overflow-y-auto scrollbar-thin"
        style={{ zIndex: 20 }}
      >
        <div className="space-y-4 flex-1">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">ATLAS WASTE · Mapa</h3>
            <p className="text-slate-400 text-[11px] mt-0.5">Regiones, zonas, flota y optimización IA</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2 bg-slate-800/40 rounded-lg border border-slate-750">
              <span className="text-slate-400 block font-semibold text-[9px] uppercase tracking-wider">Contenedores</span>
              <span className="text-base font-bold text-white mt-0.5 block">{containers.length}</span>
            </div>
            <div className="p-2 bg-slate-800/40 rounded-lg border border-slate-750">
              <span className="text-slate-400 block font-semibold text-[9px] uppercase tracking-wider">Catálogo Zonas</span>
              <span className="text-base font-bold text-sky-400 mt-0.5 block">{zoneCatalog.length}</span>
            </div>
          </div>

          {/* Mode Selector Tabs */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setViewMode("region");
                setSelectedZoneId(null);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === "region"
                  ? "bg-slate-800 text-white shadow-md border border-slate-700"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Visualizar Región
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("zone");
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === "zone"
                  ? "bg-slate-800 text-white shadow-md border border-slate-700"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Visualizar Zona
            </button>
          </div>

          {/* Mode Specific Dropdowns */}
          <div className="p-3 bg-slate-850/40 rounded-xl border border-slate-750/80 space-y-2">
            {viewMode === "region" ? (
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Región Activa</label>
                <select
                  value={selectedRegionId}
                  onChange={(e) => {
                    setSelectedRegionId(e.target.value);
                    setSelectedZoneId(null);
                  }}
                  className="input w-full text-xs py-1.5"
                >
                  <option value="">— Seleccionar Región —</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Zona activa</label>
                <select
                  value={selectedZoneId || ""}
                  onChange={(e) => {
                    const zid = e.target.value;
                    setSelectedZoneId(zid || null);
                    const activeZone = zoneCatalog.find((z) => z.id === zid);
                    if (activeZone) {
                      layerManagerRef.current?.focusZone(activeZone);
                    }
                  }}
                  className="input w-full text-xs py-1.5"
                >
                  <option value="">— Seleccionar Zona —</option>
                  {zoneCatalog.map((z) => (
                    <option key={z.id} value={z.id}>{z.nombre}</option>
                  ))}
                </select>
              </div>
            )}
            {viewMode === "region" && selectedRegionId && (
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={showZonePolygons}
                  onChange={(e) => setShowZonePolygons(e.target.checked)}
                  className="rounded accent-emerald-500"
                />
                Mostrar polígonos de zonas en el mapa
              </label>
            )}
          </div>

          {viewMode === "region" && selectedRegionSummary && (
            <div className="p-3 rounded-xl border border-emerald-500/25 bg-emerald-950/20 space-y-2">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Región: {selectedRegionSummary.region?.nombre}
              </h4>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div><span className="text-slate-500">Zonas</span><p className="font-bold text-white">{selectedRegionSummary.zoneCount}</p></div>
                <div><span className="text-slate-500">Contenedores</span><p className="font-bold text-white">{selectedRegionSummary.containerCount}</p></div>
                <div><span className="text-slate-500">Camiones</span><p className="font-bold text-sky-400">{selectedRegionSummary.truckCount}</p></div>
                <div><span className="text-slate-500">Llenado prom.</span><p className="font-bold text-amber-400">{selectedRegionSummary.avgVol}%</p></div>
              </div>
              {selectedRegionSummary.contamination > 0 && (
                <p className="text-[10px] text-rose-400 font-semibold">
                  {selectedRegionSummary.contamination} alerta(s) de contaminación
                </p>
              )}
              {!showZonePolygons && (
                <p className="text-[10px] text-slate-500">Vista agregada de región (zonas ocultas en mapa)</p>
              )}
            </div>
          )}

          {selectedZoneDetail && (
            <div className="p-3 rounded-xl border border-sky-500/30 bg-sky-950/20 space-y-2">
              <div className="flex justify-between items-start">
                <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider">Zona: {selectedZoneDetail.nombre}</h4>
                <button type="button" className="text-slate-500 hover:text-white text-xs" onClick={() => setSelectedZoneDetail(null)}>✕</button>
              </div>
              <p className="text-[11px] text-slate-400">
                Contenedores en zona: {containers.filter((c) => c.idZone === selectedZoneDetail.id).length}
              </p>
              <button
                type="button"
                className="w-full py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-white font-medium"
                onClick={() => {
                  setViewMode("zone");
                  setSelectedZoneId(selectedZoneDetail.id);
                  layerManagerRef.current?.focusZone(selectedZoneDetail);
                }}
              >
                Ver solo esta zona
              </button>
            </div>
          )}

          {/* Collapsible Section 1: Contenedores */}
          <div className="space-y-2 border border-slate-800/60 rounded-xl p-1 bg-slate-950/20">
            <CollapsibleHeader
              title="Contenedores"
              isOpen={sections.containers}
              onToggle={() => toggleSection("containers")}
              count={visibleContainers.length}
            />
            {sections.containers && (
              <div className="p-2 space-y-3">
                {canManage && (
                <button
                  type="button"
                  onClick={() => updateAddingMode(addingMode === "container" ? "idle" : "container")}
                  disabled={isSimulating}
                  className={`w-full px-3 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    addingMode === "container"
                      ? "bg-amber-600 text-white hover:bg-amber-500 animate-pulse"
                      : "bg-sky-600 hover:bg-sky-500 text-white"
                  }`}
                >
                  {addingMode === "container" ? "✓ Cancelar colocación" : "+ Colocar en el mapa"}
                </button>
                )}

                {/* Filters */}
                <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-800 space-y-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Filtros de Contenedor</span>
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
                  <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer pt-0.5">
                    <input
                      type="checkbox"
                      checked={filterSoloContaminacion}
                      onChange={(e) => setFilterSoloContaminacion(e.target.checked)}
                      className="rounded accent-green-500"
                    />
                    <span>Solo contaminación</span>
                  </label>
                </div>

                {/* List scrollable with delete buttons */}
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Contenedores visibles ({visibleContainers.length})</p>
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1 border border-slate-800/40 rounded bg-slate-900/20">
                    {visibleContainers.length === 0 ? (
                      <p className="text-[10px] text-slate-500 text-center py-4">
                        {viewMode === "region" && !selectedRegionId
                          ? "Selecciona una región para ver contenedores"
                          : viewMode === "zone" && !selectedZoneId
                          ? "Selecciona una zona para ver contenedores"
                          : "No hay contenedores en esta vista"}
                      </p>
                    ) : (
                      visibleContainers.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between p-1.5 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800/60 rounded text-xs gap-2 transition-all"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedContainer(c);
                              if (c.latitud && c.longitud) {
                                mapInstance.current?.setView([c.latitud, c.longitud], 18);
                              }
                            }}
                            className="flex-1 text-left truncate text-slate-300 hover:text-white cursor-pointer font-medium"
                            title={c.nombre || c.ubicacion}
                          >
                            {c.nombre || c.ubicacion || `Contenedor #${c.id}`}
                          </button>
                          {canManage && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteContainer(e, c.id)}
                            className="text-slate-500 hover:text-red-400 p-0.5 rounded hover:bg-slate-800 transition-all cursor-pointer"
                            title="Eliminar contenedor"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Collapsible Section 2: Camiones */}
          <div className="space-y-2 border border-slate-800/60 rounded-xl p-1 bg-slate-950/20">
            <CollapsibleHeader
              title="Camiones"
              isOpen={sections.trucks}
              onToggle={() => toggleSection("trucks")}
              count={visibleTrucks.length}
            />
            {sections.trucks && (
              <div className="p-2 space-y-3">
                {canManage && (
                <button
                  type="button"
                  onClick={() => updateAddingMode(addingMode === "truck" ? "idle" : "truck")}
                  disabled={isSimulating}
                  className={`w-full px-3 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    addingMode === "truck"
                      ? "bg-amber-600 text-white hover:bg-amber-500 animate-pulse"
                      : "bg-sky-600 hover:bg-sky-500 text-white"
                  }`}
                >
                  {addingMode === "truck" ? "✓ Cancelar colocación" : "+ Colocar en el mapa"}
                </button>
                )}

                {/* List scrollable with delete buttons */}
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Camiones visibles ({visibleTrucks.length})</p>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1 border border-slate-800/40 rounded bg-slate-900/20">
                    {visibleTrucks.length === 0 ? (
                      <p className="text-[10px] text-slate-500 text-center py-4">
                        {viewMode === "region" && !selectedRegionId
                          ? "Selecciona una región para ver camiones"
                          : viewMode === "zone" && !selectedZoneId
                          ? "Selecciona una zona para ver camiones"
                          : "No hay camiones asignados a esta región"}
                      </p>
                    ) : (
                      visibleTrucks.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between p-1.5 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800/60 rounded text-xs gap-2 transition-all"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (t.latitud && t.longitud) {
                                mapInstance.current?.setView([t.latitud, t.longitud], 18);
                              }
                            }}
                            className="flex-1 text-left truncate cursor-pointer"
                          >
                            <span className="font-bold text-sky-400">{t.placa}</span>
                            <span className="text-[9px] text-slate-500 ml-1.5">({t.estado})</span>
                          </button>
                          {canManage && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteTruck(e, t.id)}
                            className="text-slate-500 hover:text-red-400 p-0.5 rounded hover:bg-slate-800 transition-all cursor-pointer"
                            title="Eliminar camión"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Collapsible Section 3: Zonas */}
          <div className="space-y-2 border border-slate-800/60 rounded-xl p-1 bg-slate-950/20">
            <CollapsibleHeader
              title="Zonas"
              isOpen={sections.zones}
              onToggle={() => toggleSection("zones")}
              count={zoneCatalog.length}
            />
            {sections.zones && (
              <div className="p-2 space-y-3">
                {/* Zone drawing trigger */}
                {canManage && !isDrawing ? (
                  <button
                    type="button"
                    onClick={handleStartDraw}
                    disabled={isSimulating}
                    className="w-full px-3 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    + Dibujar zona en el mapa
                  </button>
                ) : canManage && isDrawing ? (
                  <div className="space-y-2 p-2 bg-slate-900 border border-sky-500/40 rounded-lg">
                    <span className="text-[10px] text-sky-300 font-bold block text-center uppercase tracking-wide">Modo dibujo activo</span>
                    <button
                      type="button"
                      onClick={() => drawControllerRef.current?.finishDrawing()}
                      className="w-full px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold cursor-pointer"
                    >
                      Finalizar zona
                    </button>
                    <button
                      type="button"
                      onClick={() => drawControllerRef.current?.undoVertex()}
                      className="w-full px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs cursor-pointer border border-slate-700"
                    >
                      Deshacer último punto
                    </button>
                    <button
                      type="button"
                      onClick={() => drawControllerRef.current?.cancelDrawing()}
                      className="w-full px-3 py-1.5 bg-red-950/80 hover:bg-red-900 text-white rounded text-xs cursor-pointer border border-red-900/30"
                    >
                      Cancelar (ESC)
                    </button>
                  </div>
                ) : null}

                {drawError && (
                  <p className="text-[10px] text-red-400 bg-red-950/40 p-2 rounded border border-red-500/30">
                    {drawError}
                  </p>
                )}

                {/* List scrollable with delete buttons */}
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Catálogo General de Zonas ({zoneCatalog.length})</p>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1 border border-slate-800/40 rounded bg-slate-900/20">
                    {zoneCatalog.length === 0 ? (
                      <p className="text-[10px] text-slate-500 text-center py-4">Dibuja una zona para empezar</p>
                    ) : (
                      zoneCatalog.map((z) => (
                        <div
                          key={z.id}
                          className="flex items-center justify-between p-1.5 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800/60 rounded text-xs gap-2 transition-all"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedZoneId(z.id);
                              setSelectedZoneDetail(z);
                              layerManagerRef.current?.focusZone(z);
                            }}
                            className={`flex-1 text-left truncate cursor-pointer font-medium ${
                              selectedZoneId === z.id ? "text-sky-400 font-bold" : "text-slate-300"
                            }`}
                          >
                            {z.nombre}
                            {z.regionId && <span className="text-[8px] text-slate-500 ml-1.5">(Reg)</span>}
                          </button>
                          {canManage && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteZone(e, z.id)}
                            className="text-slate-500 hover:text-red-400 p-0.5 rounded hover:bg-slate-800 transition-all cursor-pointer"
                            title="Eliminar zona de catálogo"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Collapsible Section 4: Regiones */}
          <div className="space-y-2 border border-slate-800/60 rounded-xl p-1 bg-slate-950/20">
            <CollapsibleHeader
              title="Regiones"
              isOpen={sections.regions}
              onToggle={() => toggleSection("regions")}
              count={regions.length}
            />
            {sections.regions && (
              <div className="p-2 space-y-3">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <select
                      value={selectedRegionId}
                      onChange={(e) => setSelectedRegionId(e.target.value)}
                      className="input flex-1 text-xs py-1.5"
                    >
                      <option value="">— Seleccionar —</option>
                      {regions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.nombre}
                        </option>
                      ))}
                    </select>
                    {canManage && selectedRegionId && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRegion(selectedRegionId)}
                        className="px-2 py-1.5 bg-red-950/60 border border-red-900/30 text-red-400 hover:bg-red-900 hover:text-white rounded text-xs cursor-pointer font-bold transition-all"
                        title="Eliminar región seleccionada"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                  {canManage && (
                  <div className="flex gap-1.5">
                    <input
                      className="input flex-1 text-xs py-1.5"
                      placeholder="Nueva región"
                      value={newRegionName}
                      onChange={(e) => setNewRegionName(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleCreateRegion}
                      className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-bold cursor-pointer transition-all"
                    >
                      +
                    </button>
                  </div>
                  )}
                </div>

                {selectedRegionId && !canManage && (
                  <div className="border-t border-slate-800 pt-2 space-y-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Zonas en esta región</p>
                    {zones.filter((z) => z.idRegion === selectedRegionId).map((z) => (
                      <button
                        key={z.id}
                        type="button"
                        onClick={() => {
                          setSelectedZoneDetail(z);
                          setSelectedZoneId(z.id);
                          layerManagerRef.current?.focusZone(z);
                        }}
                        className="w-full text-left px-2 py-1.5 text-xs rounded bg-slate-900/50 hover:bg-slate-800 text-slate-300"
                      >
                        {z.nombre}
                      </button>
                    ))}
                  </div>
                )}

                {selectedRegionId && canManage && (
                  <div className="space-y-2">
                    <div className="border-t border-slate-800 pt-2">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">
                        Zonas en esta Región
                      </p>
                      <div className="max-h-32 overflow-y-auto space-y-1 border border-slate-800 rounded-lg p-2 bg-slate-950/40">
                        {zoneCatalog.length === 0 ? (
                          <p className="text-[10px] text-slate-500 py-2 text-center">No hay zonas registradas</p>
                        ) : (
                          zoneCatalog.map((z) => (
                            <button
                              type="button"
                              key={z.id}
                              onClick={() => {
                                setSelectedZoneDetail(z);
                                setSelectedZoneId(z.id);
                                layerManagerRef.current?.focusZone(z);
                              }}
                              className="flex w-full items-center gap-2 text-xs text-slate-300 cursor-pointer hover:bg-slate-800/40 rounded px-1.5 py-1 transition-all text-left"
                            >
                              {canManage && (
                              <input
                                type="checkbox"
                                checked={regionZoneIds.includes(z.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleCatalogZoneInRegion(z.id);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="rounded accent-green-500 cursor-pointer"
                              />
                              )}
                              <span className="flex-1 truncate">{z.nombre}</span>
                              {z.regionId && z.regionId !== selectedRegionId && (
                                <span className="text-[8px] text-amber-500 uppercase font-bold tracking-wider">otra reg.</span>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={loading || !selectedRegionId}
                      onClick={handleSaveRegionZones}
                      className="w-full py-2 text-xs bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 font-bold transition-all cursor-pointer"
                    >
                      Guardar zonas asignadas
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Route Optimization Control Area */}
          <div className="p-3.5 bg-slate-850/60 rounded-xl border border-slate-750/80 space-y-3 mt-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Optimización de Ruta (IA)
            </h4>

            {!activeRoute ? (
              <div className="space-y-2">
                <button
                  disabled={isSimulating || loading || isDrawing}
                  onClick={handleOptimizeRoute}
                  className="w-full btn-primary py-2 text-xs cursor-pointer"
                >
                  Ruta global (IA)
                </button>
                <button
                  disabled={isSimulating || loading || isDrawing || !selectedZoneId}
                  onClick={handleOptimizeZone}
                  className="w-full px-3 py-2 bg-slate-800 hover:bg-slate-750 text-white rounded-lg text-xs border border-slate-700 cursor-pointer transition-all"
                >
                  Simular zona seleccionada
                </button>
                <button
                  disabled={isSimulating || loading || isDrawing || !selectedRegionId}
                  onClick={handleOptimizeRegion}
                  className="w-full px-3 py-2 bg-slate-800 hover:bg-slate-750 text-white rounded-lg text-xs border border-slate-700 cursor-pointer transition-all"
                >
                  Simular región (por zona)
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-2.5 bg-slate-950/40 rounded-lg space-y-2 text-xs border border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Camión:</span>
                    <span className="font-semibold text-sky-400">{activeRoute.truck.placa}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Paradas:</span>
                    <span className="font-semibold text-white">
                      {activeRoute.metrics?.totalContainers ?? activeRoute.containers.length}
                    </span>
                  </div>
                  {activeRoute.scope && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Ámbito:</span>
                      <span className="font-semibold text-amber-400 uppercase tracking-wide text-[9px]">{activeRoute.scope}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleClearRoute}
                    disabled={isSimulating}
                    className="flex-1 px-3 py-2 bg-slate-800 text-white rounded-lg text-xs border border-slate-700 hover:bg-slate-700 cursor-pointer transition-all"
                  >
                    Limpiar
                  </button>
                  <button
                    onClick={handleStartSimulation}
                    disabled={isSimulating}
                    className="flex-1 btn-primary py-2 text-xs font-bold cursor-pointer"
                  >
                    Iniciar simulación
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Selected element panel */}
          {selectedContainer ? (
            <div className="p-3 bg-slate-800/40 border border-slate-750/50 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between items-start">
                <h4 className="font-bold text-sky-400 uppercase tracking-wider text-[9px]">
                  Detalles del Contenedor
                </h4>
                <button
                  type="button"
                  onClick={() => setSelectedContainer(null)}
                  className="text-slate-500 hover:text-white cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">
                  {selectedContainer.nombre || selectedContainer.ubicacion}
                </p>
                <p className="text-slate-450 mt-1">
                  Zona: {selectedContainer.zona || selectedContainer.idZone || "—"}
                </p>
                <p className="text-slate-450">
                  Ubicación: {selectedContainer.ubicacion || "—"}
                </p>
                <p className="text-slate-450">
                  Residuo: <span className="text-slate-300 font-semibold">{selectedContainer.tipoResiduo || "—"}</span>
                </p>
              </div>
            </div>
          ) : (
            <p className="text-center text-[10px] text-slate-500 p-4 border border-dashed border-slate-800 rounded-xl">
              Haz clic en un marcador para ver sus detalles.
            </p>
          )}
        </div>

        <div className="pt-4 border-t border-slate-800 text-center flex justify-between text-[10px] text-slate-500 mt-4">
          <span>Actualización automática</span>
          <button type="button" onClick={() => setTick((t) => t + 1)} className="hover:text-white underline cursor-pointer">
            Refrescar
          </button>
        </div>
      </aside>
    </div>
  );
}

