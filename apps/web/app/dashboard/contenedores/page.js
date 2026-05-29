"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

const WASTE_CATEGORIES = [
  "Orgánicos",
  "Inorgánicos",
  "Reciclables",
  "Plástico",
  "Papel/Cartón",
  "Vidrio/Metal",
  "Químicos",
  "Metales pesados",
  "Residuos especiales",
];

const ESTADOS_OPERATIVOS = ["Activo", "Inactivo", "Mantenimiento"];
const ESTADOS_LLENADO = ["Vacío", "Medio", "Lleno"];
const PRIORIDADES = ["alta", "media", "baja"];

export default function ContenedoresPage() {
  const [containers, setContainers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [nombre, setNombre] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [zona, setZona] = useState("");
  const [latitud, setLatitud] = useState(25.533);
  const [longitud, setLongitud] = useState(-103.436);
  const [capacidadMax, setCapacidadMax] = useState(200);
  const [estado, setEstado] = useState("Vacío");
  const [estadoOperativo, setEstadoOperativo] = useState("Activo");
  const [tipoResiduo, setTipoResiduo] = useState("Orgánicos");
  const [allowedTypes, setAllowedTypes] = useState(["Orgánicos"]);
  const [prioridadConfigurada, setPrioridadConfigurada] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cRes, aRes] = await Promise.all([
        api.containersList(),
        api.containerAlerts({ resueltas: false }),
      ]);
      setContainers(cRes.containers || []);
      setAlerts(aRes.alerts || []);
      setError("");
    } catch (e) {
      setError("No se pudieron cargar los contenedores: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNombre("");
    setUbicacion("");
    setZona("");
    setLatitud(25.533);
    setLongitud(-103.436);
    setCapacidadMax(200);
    setEstado("Vacío");
    setEstadoOperativo("Activo");
    setTipoResiduo("Orgánicos");
    setAllowedTypes(["Orgánicos"]);
    setPrioridadConfigurada("");
  };

  const handleOpenAdd = () => {
    setEditing(null);
    resetForm();
    setModalOpen(true);
  };

  const handleOpenEdit = (c) => {
    setEditing(c);
    setNombre(c.nombre || "");
    setUbicacion(c.ubicacion || "");
    setZona(c.zona || "");
    setLatitud(c.latitud || 25.533);
    setLongitud(c.longitud || -103.436);
    setCapacidadMax(c.capacidadMax || 200);
    setEstado(c.estado || "Vacío");
    setEstadoOperativo(c.estadoOperativo || "Activo");
    setTipoResiduo(c.tipoResiduo || "Orgánicos");
    setAllowedTypes(c.tiposResiduosPermitidos?.length ? c.tiposResiduosPermitidos : [c.tipoResiduo || "Orgánicos"]);
    setPrioridadConfigurada(c.prioridadConfigurada || "");
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este contenedor y sus sensores asociados?")) return;
    try {
      await api.containerDelete(id);
      fetchData();
    } catch (e) {
      alert("Error al eliminar: " + e.message);
    }
  };

  const toggleAllowed = (type) => {
    if (allowedTypes.includes(type)) {
      setAllowedTypes(allowedTypes.filter((t) => t !== type));
    } else {
      setAllowedTypes([...allowedTypes, type]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) return alert("El nombre es obligatorio.");
    if (allowedTypes.length === 0) return alert("Seleccione al menos un tipo de residuo permitido.");

    const payload = {
      nombre: nombre.trim(),
      ubicacion: ubicacion.trim() || nombre.trim(),
      zona: zona.trim() || undefined,
      latitud: Number(latitud),
      longitud: Number(longitud),
      capacidadMax: Number(capacidadMax),
      estado,
      estadoOperativo,
      tipoResiduo,
      tiposResiduosPermitidos: allowedTypes,
      prioridadConfigurada: prioridadConfigurada || undefined,
    };

    try {
      if (editing) {
        await api.containerUpdate(editing.id, payload);
      } else {
        await api.containerCreate(payload);
      }
      setModalOpen(false);
      fetchData();
    } catch (e) {
      alert("Error al guardar: " + e.message);
    }
  };

  const handleResolveAlert = async (alertId) => {
    try {
      await api.containerAlertResolve(alertId);
      fetchData();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Contenedores Inteligentes</h1>
          <p className="text-slate-400 text-sm mt-1">
            Administra contenedores, tipos de residuo permitidos e inferencia por sensores.
          </p>
        </div>
        <button onClick={handleOpenAdd} className="btn-primary px-4 py-2 text-sm">
          + Nuevo Contenedor
        </button>
      </div>

      {alerts.length > 0 && (
        <div className="card border-rose-500/40 bg-rose-950/20 space-y-3">
          <h3 className="text-sm font-bold text-rose-400 uppercase tracking-wider">
            Alertas de contaminación ({alerts.length})
          </h3>
          {alerts.slice(0, 5).map((a) => (
            <div key={a.id} className="flex justify-between items-start gap-4 text-xs border-b border-rose-900/50 pb-2 last:border-0">
              <div>
                <span className="font-semibold text-white">{a.contenedor?.nombre || a.contenedor?.ubicacion}</span>
                <p className="text-slate-400 mt-0.5">{a.mensaje}</p>
                <p className="text-slate-500 mt-1">
                  Esperado: {a.tipoEsperado} · Inferido: {a.tipoInferido}
                </p>
              </div>
              <button
                onClick={() => handleResolveAlert(a.id)}
                className="shrink-0 px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
              >
                Resolver
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-rose-400 text-sm">{error}</p>}

      {loading ? (
        <p className="text-slate-400">Cargando contenedores…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {containers.map((c) => {
            const vol = c.ia?.volumenPct != null ? Math.round(c.ia.volumenPct) : 0;
            const priority = c.ia?.prioridadEfectiva || c.ia?.prioridad || "baja";
            const priorityColor =
              priority === "alta" ? "text-rose-400" : priority === "media" ? "text-amber-400" : "text-green-400";

            return (
              <div
                key={c.id}
                className={`card relative flex flex-col justify-between hover:border-slate-500 transition-all group ${
                  c.ia?.contaminacionDetectada ? "border-rose-500/50 bg-rose-950/10" : ""
                }`}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-bold text-white">{c.nombre || c.ubicacion}</span>
                        {c.ia?.contaminacionDetectada && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            Contaminación
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 text-xs mt-0.5">{c.ubicacion} · {c.zona || "Sin zona"}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleOpenEdit(c)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white" title="Editar">
                        ✎
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-rose-900/50 rounded text-slate-400 hover:text-rose-400" title="Eliminar">
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 block">Esperado</span>
                      <span className="text-green-400 font-semibold">{c.tipoResiduo || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Inferido (IA)</span>
                      <span className="text-sky-400 font-semibold">{c.ia?.tipoResiduoInferido || "Sin datos"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Estado operativo</span>
                      <span className="text-white">{c.estadoOperativo || "Activo"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Prioridad</span>
                      <span className={`font-semibold capitalize ${priorityColor}`}>{priority}</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">Llenado</span>
                      <span className="text-white font-semibold">{vol}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${vol}%` }} />
                    </div>
                  </div>

                  {c.tiposResiduosPermitidos?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {c.tiposResiduosPermitidos.map((t) => (
                        <span key={t} className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px]">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {c.sensores?.length > 0 && (
                    <p className="text-slate-600 text-[10px]">
                      {c.sensores.length} sensor(es): {c.sensores.map((s) => s.tipo).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h2 className="text-xl font-bold text-white">
              {editing ? "Editar Contenedor" : "Nuevo Contenedor"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Nombre / Identificador">
                <input className="input w-full" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              </Field>
              <Field label="Ubicación descriptiva">
                <input className="input w-full" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder="Ej. Edificio 19, planta baja" />
              </Field>
              <Field label="Zona / Sector">
                <input className="input w-full" value={zona} onChange={(e) => setZona(e.target.value)} placeholder="Ej. Campus Norte" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Latitud">
                  <input type="number" step="any" className="input w-full" value={latitud} onChange={(e) => setLatitud(e.target.value)} />
                </Field>
                <Field label="Longitud">
                  <input type="number" step="any" className="input w-full" value={longitud} onChange={(e) => setLongitud(e.target.value)} />
                </Field>
              </div>
              <Field label="Capacidad máxima (litros)">
                <input type="number" className="input w-full" value={capacidadMax} onChange={(e) => setCapacidadMax(e.target.value)} min={1} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Estado de llenado">
                  <select className="input w-full" value={estado} onChange={(e) => setEstado(e.target.value)}>
                    {ESTADOS_LLENADO.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Estado operativo">
                  <select className="input w-full" value={estadoOperativo} onChange={(e) => setEstadoOperativo(e.target.value)}>
                    {ESTADOS_OPERATIVOS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Tipo de residuo esperado">
                <select className="input w-full" value={tipoResiduo} onChange={(e) => setTipoResiduo(e.target.value)}>
                  {WASTE_CATEGORIES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Tipos de residuo permitidos">
                <div className="flex flex-wrap gap-2">
                  {WASTE_CATEGORIES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleAllowed(t)}
                      className={`px-2 py-1 rounded text-xs border transition-colors ${
                        allowedTypes.includes(t)
                          ? "bg-green-500/20 border-green-500/50 text-green-400"
                          : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Prioridad configurable (opcional)">
                <select className="input w-full" value={prioridadConfigurada} onChange={(e) => setPrioridadConfigurada(e.target.value)}>
                  <option value="">Automática (IA + sensores)</option>
                  {PRIORIDADES.map((p) => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </Field>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2 bg-slate-800 text-white rounded-lg border border-slate-700">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 btn-primary py-2">
                  {editing ? "Guardar cambios" : "Crear contenedor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      {children}
    </label>
  );
}
