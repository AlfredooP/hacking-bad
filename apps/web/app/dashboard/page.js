"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import Link from "next/link";

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .dashboardStats()
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading stats:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-slate-400">
        Cargando estadísticas del sistema…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Resumen Operativo</h1>
        <p className="text-slate-400 text-sm mt-1">
          Estado en tiempo real del sistema inteligente de recolección de residuos.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          label="Contenedores Totales"
          value={stats?.totalContenedores ?? 0}
          icon={
            <svg className="w-6 h-6 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />
        
        <StatCard
          label="Evaluados por IA"
          value={stats?.conClasificacion ?? 0}
          subtitle={`Clasificados: ${Math.round(((stats?.conClasificacion ?? 0) / (stats?.totalContenedores || 1)) * 100)}%`}
          icon={
            <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />

        <StatCard
          label="Urgencia Crítica (Alta)"
          value={stats?.prioridadAlta ?? 0}
          highlight={stats?.prioridadAlta > 0}
          subtitle="Requieren atención inmediata"
          icon={
            <svg className="w-6 h-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />

        <StatCard
          label="Alertas Contaminación"
          value={stats?.alertasContaminacion ?? 0}
          highlight={stats?.alertasContaminacion > 0}
          subtitle="Discrepancia esperado vs inferido"
          icon={
            <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-3.07L13.74 4.6a2 2 0 00-3.48 0L3.33 15.93A2 2 0 005.07 19z" />
            </svg>
          }
        />

        <StatCard
          label="Flota de Camiones"
          value={`${stats?.activeTrucks ?? 0} / ${stats?.totalTrucks ?? 0}`}
          subtitle="Camiones disponibles"
          icon={
            <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10M21 16V10a1 1 0 00-1-1h-7m8 7H13" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fill level progress card */}
        <div className="card backdrop-blur-md bg-opacity-70 col-span-1 lg:col-span-2 space-y-6">
          <h3 className="text-xl font-bold text-white">Nivel General de Ocupación</h3>
          
          <div className="flex flex-col md:flex-row items-center gap-8 py-4">
            {/* Circular progress display */}
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" stroke="#1e293b" strokeWidth="8" fill="transparent" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#22c55e"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 40}
                  strokeDashoffset={2 * Math.PI * 40 * (1 - (stats?.avgVolume ?? 0) / 100)}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-extrabold text-white">{stats?.avgVolume ?? 0}%</span>
                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Promedio</span>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <h4 className="text-md font-semibold text-slate-200">Capacidad Total de Almacenamiento</h4>
                <p className="text-slate-400 text-sm mt-1">
                  El nivel promedio de llenado de todos los contenedores evaluados por IA se encuentra en un <span className="text-green-400 font-bold">{stats?.avgVolume ?? 0}%</span>.
                </p>
              </div>
              <div className="flex gap-4">
                <Link
                  href="/dashboard/mapa"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg text-sm border border-slate-700 hover:scale-102 transition-transform"
                >
                  Ver Mapa Crítico
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Informative tips box */}
        <div className="card backdrop-blur-md bg-opacity-70 bg-gradient-to-br from-slate-900/90 to-indigo-950/20 border border-slate-700/50 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Recomendación IA
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              {stats?.prioridadAlta > 0
                ? `Hay ${stats.prioridadAlta} contenedor(es) crítico(s) con prioridad alta de recolección. Se recomienda despachar un camión compatible utilizando la optimización de rutas.`
                : "Todos los contenedores están bajo niveles de llenado aceptables. No se requiere despacho de emergencia."}
            </p>
          </div>
          <Link
            href="/dashboard/mapa"
            className="w-full btn-primary text-center block mt-6 text-sm py-2"
          >
            Optimizar Rutas ahora
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, subtitle, icon, highlight }) {
  return (
    <div
      className={`card flex items-center justify-between backdrop-blur-md bg-opacity-70 hover:border-slate-500 transition-all ${
        highlight ? "border-rose-500/40 bg-rose-950/10" : ""
      }`}
    >
      <div className="space-y-2">
        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">{label}</span>
        <span className="text-3xl font-extrabold text-white block">{value}</span>
        {subtitle && <span className="text-slate-500 text-xs block">{subtitle}</span>}
      </div>
      <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/50">{icon}</div>
    </div>
  );
}
