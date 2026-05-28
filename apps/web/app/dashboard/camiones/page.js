"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

export default function CamionesPage() {
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState(null);

  // Form state
  const [placa, setPlaca] = useState("");
  const [capacidadMax, setCapacidadMax] = useState(1000);
  const [capacidadDisponible, setCapacidadDisponible] = useState(1000);
  const [estado, setEstado] = useState("Disponible");
  const [latitud, setLatitud] = useState(25.533);
  const [longitud, setLongitud] = useState(-103.435);
  const [selectedTypes, setSelectedTypes] = useState([]);

  const WASTE_CATEGORIES = [
    "Orgánicos",
    "Inorgánicos",
    "Reciclables",
    "Químicos",
    "Metales pesados",
    "Residuos especiales"
  ];

  useEffect(() => {
    fetchTrucks();
  }, []);

  const fetchTrucks = async () => {
    try {
      setLoading(true);
      const data = await api.trucksList();
      setTrucks(data.trucks || []);
      setError("");
    } catch (e) {
      setError("No se pudo cargar la flota de camiones: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingTruck(null);
    setPlaca("");
    setCapacidadMax(1000);
    setCapacidadDisponible(1000);
    setEstado("Disponible");
    setLatitud(25.533);
    setLongitud(-103.435);
    setSelectedTypes(["Orgánicos"]);
    setModalOpen(true);
  };

  const handleOpenEdit = (truck) => {
    setEditingTruck(truck);
    setPlaca(truck.placa || "");
    setCapacidadMax(truck.capacidadMax || 1000);
    setCapacidadDisponible(truck.capacidadDisponible != null ? truck.capacidadDisponible : truck.capacidadMax || 1000);
    setEstado(truck.estado || "Disponible");
    setLatitud(truck.latitud || 25.533);
    setLongitud(truck.longitud || -103.435);
    setSelectedTypes(truck.tipoResiduos ? truck.tipoResiduos.split(",").map(t => t.trim()) : []);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Está seguro de que desea eliminar este camión?")) return;
    try {
      await api.truckDelete(id);
      fetchTrucks();
    } catch (e) {
      alert("Error al eliminar: " + e.message);
    }
  };

  const handleTypeToggle = (type) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!placa) return alert("La placa es obligatoria.");
    if (selectedTypes.length === 0) return alert("Seleccione al menos un tipo de residuo compatible.");

    const payload = {
      placa,
      capacidad: `${capacidadMax}kg`,
      capacidadMax: Number(capacidadMax),
      capacidadDisponible: Number(capacidadDisponible),
      estado,
      latitud: Number(latitud),
      longitud: Number(longitud),
      tipoResiduos: selectedTypes.join(",")
    };

    try {
      if (editingTruck) {
        await api.truckUpdate(editingTruck.id, payload);
      } else {
        await api.truckCreate(payload);
      }
      setModalOpen(false);
      fetchTrucks();
    } catch (e) {
      alert("Error al guardar camión: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Flota de Camiones</h1>
          <p className="text-slate-400 text-sm mt-1">
            Administra los camiones recolectores, su estado operativo y capacidades.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="btn-primary flex items-center gap-2 hover:scale-105 transition-transform"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Registrar Camión
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-950/40 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-400 py-12">Cargando flota de camiones...</div>
      ) : trucks.length === 0 ? (
        <div className="text-center text-slate-400 py-16 border border-dashed border-slate-700 rounded-xl">
          <svg className="w-12 h-12 mx-auto text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10M21 16V10a1 1 0 00-1-1h-7m8 7H13" />
          </svg>
          <p className="font-semibold text-white">No hay camiones registrados</p>
          <p className="text-slate-500 text-sm mt-1">Registra tu primer camión para iniciar la simulación de recolección.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trucks.map((truck) => {
            const capMax = truck.capacidadMax || 1000;
            const capDisp = truck.capacidadDisponible != null ? truck.capacidadDisponible : capMax;
            const capUsada = capMax - capDisp;
            const pctUsado = Math.min(100, Math.round((capUsada / capMax) * 100));

            return (
              <div
                key={truck.id}
                className="card relative flex flex-col justify-between hover:border-slate-500 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-md bg-opacity-70 group"
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-white tracking-wide">{truck.placa}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                            truck.estado === "Disponible"
                              ? "bg-green-500/20 text-green-400 border border-green-500/30"
                              : truck.estado === "En Ruta"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-red-500/20 text-red-400 border border-red-500/30"
                          }`}
                        >
                          {truck.estado}
                        </span>
                      </div>
                      <p className="text-slate-500 text-xs mt-1">ID: #{truck.id}</p>
                    </div>

                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEdit(truck)}
                        className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                        title="Editar"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(truck.id)}
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-slate-800"
                        title="Eliminar"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Capacidad Ocupada:</span>
                      <span className="font-medium text-white">
                        {capUsada}kg / {capMax}kg ({pctUsado}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          pctUsado >= 85
                            ? "bg-red-500"
                            : pctUsado >= 60
                            ? "bg-amber-500"
                            : "bg-green-500"
                        }`}
                        style={{ width: `${pctUsado}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>
                        Lat: {truck.latitud?.toFixed(5) || "—"}, Lng: {truck.longitud?.toFixed(5) || "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-700 mt-4 pt-3">
                  <div className="flex flex-wrap gap-1.5">
                    {truck.tipoResiduos?.split(",").map((type) => (
                      <span
                        key={type}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700"
                      >
                        {type.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md bg-slate-900 border border-slate-700 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">
                {editingTruck ? "Editar Camión" : "Registrar Nuevo Camión"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 block">Placa / Identificador</label>
                <input
                  type="text"
                  value={placa}
                  onChange={(e) => setPlaca(e.target.value)}
                  placeholder="Ej: TRK-123"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-green-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 block">Capacidad Max (kg)</label>
                  <input
                    type="number"
                    value={capacidadMax}
                    onChange={(e) => {
                      setCapacidadMax(e.target.value);
                      if (!editingTruck) setCapacidadDisponible(e.target.value);
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-green-500 focus:outline-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 block">Capacidad Disponible (kg)</label>
                  <input
                    type="number"
                    value={capacidadDisponible}
                    onChange={(e) => setCapacidadDisponible(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-green-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 block">Estado Operativo</label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-green-500 focus:outline-none"
                >
                  <option value="Disponible">Disponible</option>
                  <option value="En Ruta">En Ruta</option>
                  <option value="Mantenimiento">Mantenimiento</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 block">Latitud Actual</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={latitud}
                    onChange={(e) => setLatitud(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-green-500 focus:outline-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400 block">Longitud Actual</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={longitud}
                    onChange={(e) => setLongitud(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white text-sm focus:border-green-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 block">Tipos de Residuo Compatibles</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {WASTE_CATEGORIES.map((cat) => {
                    const isSelected = selectedTypes.includes(cat);
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => handleTypeToggle(cat)}
                        className={`p-2 rounded-lg text-xs font-medium text-left border transition-all ${
                          isSelected
                            ? "bg-green-500/20 text-green-400 border-green-500"
                            : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500"
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 bg-slate-800 text-white font-semibold py-2.5 rounded-lg border border-slate-700 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary py-2.5 text-sm"
                >
                  {editingTruck ? "Actualizar" : "Registrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
