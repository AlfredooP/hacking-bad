"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { api } from "@/lib/api-client";
import MetricCard from "@/components/dashboard/MetricCard";

const FillLevelChart = dynamic(() => import("@/components/dashboard/FillLevelChart"), {
  ssr: false,
  loading: () => <ChartSkeleton title="PORCENTAJE DE LLENADO" />,
});

const PriorityDonutChart = dynamic(() => import("@/components/dashboard/PriorityDonutChart"), {
  ssr: false,
  loading: () => <ChartSkeleton title="ESTADOS DE LOS CONTENEDORES" />,
});

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .dashboardStats()
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return <p className="text-red-400">Error al cargar dashboard: {error}</p>;
  }

  if (!stats) {
    return <p className="text-slate-400">Cargando dashboard…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/dashboard/mapa" className="text-sm text-green-400 hover:underline">
          Ver mapa interactivo →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <MetricCard
          label="Total Contenedores"
          value={stats.totalContenedores}
          subtitle="Red activa BIN"
          icon="containers"
          accent="green"
        />
        <MetricCard
          label="Alertas Críticas"
          value={stats.alertasCriticas}
          subtitle="Prioridad Alta detectada"
          icon="alert"
          accent="red"
        />
        <MetricCard
          label="Humedad Promedio"
          value={stats.humedadPromedio != null ? `${stats.humedadPromedio}%` : "—"}
          subtitle="Promedio de red BIN"
          icon="humidity"
          accent="blue"
        />
        <MetricCard
          label="Temp. Promedio"
          value={stats.tempPromedio != null ? `${stats.tempPromedio}°C` : "—"}
          subtitle="Estado térmico global"
          icon="temp"
          accent="amber"
        />
        <MetricCard
          label="Capacidad Total"
          value={`${stats.capacidadTotal} L`}
          subtitle="Volumen total instalado"
          icon="capacity"
          accent="slate"
        />
        <MetricCard
          label="Confianza IA"
          value={`${stats.confianzaIa}%`}
          subtitle="Precisión de clasificación"
          icon="ai"
          accent="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FillLevelChart items={stats.charts?.llenado ?? []} />
        <PriorityDonutChart prioridades={stats.charts?.prioridades} />
      </div>
    </div>
  );
}

function ChartSkeleton({ title }) {
  return (
    <div className="card min-h-[320px] flex flex-col">
      <h2 className="text-xs font-semibold tracking-widest text-slate-400 mb-4">{title}</h2>
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Cargando gráfica…
      </div>
    </div>
  );
}
