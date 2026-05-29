import { L } from "./leaflet-map-factory.js";

export const PRIORITY_COLORS = {
  alta: "#ef4444",
  media: "#f59e0b",
  baja: "#22c55e",
};

export function injectMapStyles() {
  if (typeof document === "undefined") return;
  const id = "leaflet-map-styles";
  if (document.getElementById(id)) return;

  const style = document.createElement("style");
  style.id = id;
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
    @keyframes zone-vertex-pulse {
      0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(56,189,248,0.7); }
      50% { transform: scale(1.2); box-shadow: 0 0 0 8px rgba(56,189,248,0); }
    }
    .leaflet-popup-content-wrapper {
      background: #1e293b !important;
      border: 1px solid #475569 !important;
      border-radius: 12px !important;
      color: #e2e8f0 !important;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5) !important;
    }
    .leaflet-popup-tip { background: #1e293b !important; }
    .map-drawing-mode,
    .map-drawing-mode .leaflet-container { cursor: crosshair !important; }
    .zone-vertex-icon { background: transparent !important; border: none !important; }
    .zone-vertex-inner { box-sizing: border-box; pointer-events: none; }
    .zone-vertex-inner.zone-vertex-closeable { animation: zone-vertex-pulse 1.2s ease-in-out infinite; }
    .zone-draw-tooltip {
      background: #0f172a; color: #e2e8f0; border: 1px solid #38bdf8;
      padding: 6px 10px; border-radius: 8px; font-size: 12px; white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }
  `;
  document.head.appendChild(style);
}

function createContainerMarkerEl(color, vol) {
  const el = document.createElement("div");
  el.style.cssText = "width:36px;height:36px;cursor:pointer;";

  const inner = document.createElement("div");
  inner.style.cssText =
    "position:relative;width:100%;height:100%;transition:transform 0.2s ease;transform-origin:center center;";
  inner.addEventListener("mouseenter", () => { inner.style.transform = "scale(1.25)"; });
  inner.addEventListener("mouseleave", () => { inner.style.transform = "scale(1)"; });

  const pulse = document.createElement("div");
  pulse.className = "marker-pulse-ring";
  pulse.style.cssText = `
    position:absolute;inset:-4px;border-radius:50%;opacity:0.6;pointer-events:none;
    background:${color};filter:blur(4px);
    animation:${vol >= 80 ? "marker-ping 1.5s cubic-bezier(0,0,0.2,1) infinite" : "marker-pulse 2s ease-in-out infinite"};
  `;
  inner.appendChild(pulse);

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

export function createContainerIcon(color, vol) {
  return L.divIcon({
    className: "",
    html: createContainerMarkerEl(color, vol).outerHTML,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
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

export function createTruckIcon() {
  return L.divIcon({
    className: "",
    html: createTruckMarkerEl().outerHTML,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}

export function containerPopupHTML(c, color, priority, vol) {
  const inferido = c.ia?.tipoResiduoInferido;
  const contaminacion = c.ia?.contaminacionDetectada;
  return `
    <div style="padding:14px 16px;font-family:system-ui,sans-serif;min-width:200px;">
      <h4 style="font-weight:700;font-size:14px;color:#f1f5f9;border-bottom:1px solid #334155;padding-bottom:8px;margin:0 0 10px 0;">
        ${c.nombre || c.ubicacion || "Contenedor"}
      </h4>
      ${contaminacion ? `<div style="background:#7f1d1d;color:#fecaca;padding:6px 8px;border-radius:6px;font-size:10px;margin-bottom:8px;">⚠ ${c.ia?.mensajeContaminacion || "Contaminación detectada"}</div>` : ""}
      <div style="display:flex;flex-direction:column;gap:6px;font-size:12px;">
        <div style="display:flex;justify-content:space-between;"><span style="color:#94a3b8;">Zona:</span><span style="color:#f1f5f9;font-weight:600;">${c.zona || c.idZone || "—"}</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#94a3b8;">Nivel:</span><span style="color:#f1f5f9;font-weight:600;">${vol}%</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#94a3b8;">Prioridad:</span>
          <span style="background:${color};color:#fff;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;text-transform:capitalize;">${priority}</span>
        </div>
      </div>
    </div>
  `;
}

export function truckPopupHTML(t) {
  const statusColor = t.estado === "Disponible" ? "#22c55e" : t.estado === "En Ruta" ? "#f59e0b" : "#ef4444";
  return `
    <div style="padding:14px 16px;font-family:system-ui,sans-serif;">
      <h4 style="font-weight:700;font-size:14px;color:#f1f5f9;border-bottom:1px solid #334155;padding-bottom:8px;margin:0 0 10px 0;">Camión ${t.placa}</h4>
      <div style="font-size:12px;display:flex;flex-direction:column;gap:6px;">
        <div style="display:flex;justify-content:space-between;"><span style="color:#94a3b8;">Estado:</span>
          <span style="background:${statusColor};color:#fff;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;">${t.estado}</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#94a3b8;">Carga:</span><span style="color:#f1f5f9;font-weight:600;">${t.capacidadDisponible}kg / ${t.capacidadMax}kg</span></div>
      </div>
    </div>
  `;
}

export function getContainerColor(c) {
  const priority = c.ia?.prioridadEfectiva || c.ia?.prioridad || "baja";
  return c.ia?.contaminacionDetectada
    ? "#dc2626"
    : PRIORITY_COLORS[priority] || "#64748b";
}
