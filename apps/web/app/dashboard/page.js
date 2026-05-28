"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

export default function DashboardPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.dashboardStats().then(setStats).catch(console.error);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Contenedores" value={stats?.totalContenedores ?? "—"} />
        <StatCard label="Con clasificación IA" value={stats?.conClasificacion ?? "—"} />
        <StatCard label="Prioridad alta" value={stats?.prioridadAlta ?? "—"} highlight />
      </div>
      <p className="mt-8 text-slate-400">
        Ve al{" "}
        <a href="/dashboard/mapa" className="text-green-400 hover:underline">
          mapa interactivo
        </a>{" "}
        para ver la ubicación y prioridad de cada contenedor.
      </p>
    </div>
  );
}

function StatCard({ label, value, highlight }) {
  return (
    <div className={`card ${highlight ? "border-red-500/50" : ""}`}>
      <div className="text-slate-400 text-sm">{label}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
    </div>
  );
}
