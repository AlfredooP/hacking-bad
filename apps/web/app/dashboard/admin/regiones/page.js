"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";

export default function RegionesAdminPage() {
  const [regions, setRegions] = useState([]);
  const [zones, setZones] = useState([]);
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [r, z] = await Promise.all([api.regionsList(), api.zonesList({ catalogOnly: true })]);
    setRegions(r.regions || []);
    setZones(z.zones || []);
    setLoading(false);
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    await api.regionCreate({ nombre: nombre.trim() });
    setNombre("");
    await load();
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar esta región?")) return;
    await api.regionDelete(id);
    await load();
  };

  if (loading) return <p className="text-slate-400">Cargando regiones…</p>;

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Regiones y zonas</h1>
        <p className="text-slate-400 text-sm mt-1">
          Crea regiones administrativas y asígnalas en el{" "}
          <Link href="/dashboard/mapa" className="text-emerald-400 hover:underline">
            mapa interactivo
          </Link>
          .
        </p>
      </div>

      <form onSubmit={handleCreate} className="card flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Nueva región
          </label>
          <input
            className="input w-full"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Campus Norte"
          />
        </div>
        <button type="submit" className="btn-primary shrink-0">
          Crear región
        </button>
      </form>

      <div className="space-y-4">
        {regions.length === 0 ? (
          <p className="text-slate-500 text-sm">No hay regiones. Crea la primera arriba.</p>
        ) : (
          regions.map((r) => {
            const regionZones = zones.filter((z) => z.idRegion === r.id);
            return (
              <div key={r.id} className="card space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-white">{r.nombre}</h3>
                    <p className="text-xs text-slate-500">ID: {r.id}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    className="text-xs text-red-400 hover:text-red-300 px-2 py-1 border border-red-900/40 rounded"
                  >
                    Eliminar
                  </button>
                </div>
                <p className="text-sm text-slate-400">
                  {regionZones.length} zona(s) asignada(s)
                </p>
                {regionZones.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {regionZones.map((z) => (
                      <li
                        key={z.id}
                        className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300 border border-slate-700"
                      >
                        {z.nombre}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>

      <p className="text-xs text-slate-600">
        Total catálogo de zonas: {zones.length}. Dibuja y asigna zonas desde el mapa (sección Regiones).
      </p>
    </div>
  );
}
