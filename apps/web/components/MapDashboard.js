"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const PRIORITY_COLORS = {
  alta: "#ef4444",
  media: "#f59e0b",
  baja: "#22c55e",
};

export default function MapDashboard({ containers }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const withCoords = containers.filter((c) => c.latitud && c.longitud);
    const center =
      withCoords.length > 0
        ? [withCoords[0].longitud, withCoords[0].latitud]
        : [-103.436, 25.533];

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
      zoom: 16,
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
      withCoords.forEach((c) => {
        const color = PRIORITY_COLORS[c.ia?.prioridad] || "#64748b";
        const el = document.createElement("div");
        el.style.width = "14px";
        el.style.height = "14px";
        el.style.borderRadius = "50%";
        el.style.background = color;
        el.style.border = "2px solid white";
        el.style.cursor = "pointer";

        new maplibregl.Marker({ element: el })
          .setLngLat([c.longitud, c.latitud])
          .setPopup(
            new maplibregl.Popup({ offset: 12 }).setHTML(
              `<strong>${c.ubicacion || "Contenedor"}</strong><br/>
              Estado: ${c.estado || "—"}<br/>
              Prioridad IA: ${c.ia?.prioridad || "sin datos"}<br/>
              Llenado: ${c.ia?.volumenPct != null ? `${Math.round(c.ia.volumenPct)}%` : "—"}`
            )
          )
          .addTo(map);

        el.addEventListener("click", () => setSelected(c));
      });
    });

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [containers]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-8rem)]">
      <div ref={mapRef} className="flex-1 rounded-lg overflow-hidden border border-slate-700 min-h-[300px]" />
      <aside className="lg:w-72 card overflow-y-auto">
        <h3 className="font-semibold mb-3">Contenedores ({containers.length})</h3>
        <ul className="space-y-2 text-sm">
          {containers.map((c) => (
            <li
              key={c.id}
              className={`p-2 rounded cursor-pointer border ${
                selected?.id === c.id ? "border-green-500 bg-slate-800" : "border-transparent hover:bg-slate-800"
              }`}
              onClick={() => setSelected(c)}
            >
              <div className="font-medium">{c.ubicacion || `#${c.id}`}</div>
              <div className="text-slate-400">
                {c.ia?.prioridad ? `IA: ${c.ia.prioridad}` : "Sin clasificación"}
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
