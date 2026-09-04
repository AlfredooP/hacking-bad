"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import Link from "next/link";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  RadialLinearScale,
  Filler
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  RadialLinearScale,
  Filler
);

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [mounted, setMounted] = useState(false);

  const fetchData = async () => {
    try {
      const [statsData, containersData] = await Promise.all([
        api.dashboardStats(),
        api.containersList()
      ]);
      setStats(statsData);
      setContainers(containersData.containers || []);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchData().finally(() => setLoading(false));
  }, []);

  const handleSimulate = async () => {
    setSimulating(true);
    setSuccessMsg("");
    try {
      await api.simulateContainersTelemetry();
      await fetchData();
      setSuccessMsg("¡Telemetría simulada exitosamente! Todos los contenedores han recibido nuevas lecturas y la IA ha recalculado las prioridades.");
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setSuccessMsg("");
      }, 5000);
    } catch (err) {
      console.error("Error simulating telemetry:", err);
      alert("Error al simular telemetría: " + err.message);
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-slate-400 gap-3">
        <svg className="animate-spin h-8 w-8 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-sm font-medium">Cargando estadísticas y gráficas del sistema...</span>
      </div>
    );
  }

  // Calculate chart metrics
  const statusCounts = containers.reduce(
    (acc, curr) => {
      const vol = curr.ia?.volumenPct ?? 0;
      if (vol >= 80) acc.lleno++;
      else if (vol >= 35) acc.medio++;
      else acc.vacio++;
      return acc;
    },
    { lleno: 0, medio: 0, vacio: 0 }
  );

  // 1. Doughnut Chart: Distribution of Fill Statuses
  const doughnutData = {
    labels: ["Crítico/Lleno (≥80%)", "Medio (35%-79%)", "Vacío (<35%)"],
    datasets: [
      {
        data: [statusCounts.lleno, statusCounts.medio, statusCounts.vacio],
        backgroundColor: [
          "rgba(244, 63, 94, 0.75)",  // Rose 500
          "rgba(245, 158, 11, 0.75)", // Amber 500
          "rgba(16, 185, 129, 0.75)"  // Emerald 500
        ],
        borderColor: [
          "rgba(244, 63, 94, 1)",
          "rgba(245, 158, 11, 1)",
          "rgba(16, 185, 129, 1)"
        ],
        borderWidth: 1.5,
        hoverOffset: 6,
      }
    ]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "#94a3b8", // Slate 400
          boxWidth: 12,
          padding: 12,
          font: {
            size: 11,
            weight: "600",
            family: "system-ui, -apple-system, sans-serif"
          }
        }
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        titleColor: "#ffffff",
        bodyColor: "#cbd5e1",
        borderColor: "rgba(51, 65, 85, 0.5)",
        borderWidth: 1,
        padding: 8,
        cornerRadius: 6,
      }
    },
    cutout: "65%",
  };

  // 2. Bar Chart: Fill Level % per Container
  const barData = {
    labels: containers.map(c => c.nombre || `Contenedor ${c.id}`),
    datasets: [
      {
        label: "Nivel de Llenado (%)",
        data: containers.map(c => c.ia?.volumenPct ?? 0),
        backgroundColor: "rgba(16, 185, 129, 0.65)", // Emerald 500
        borderColor: "rgba(16, 185, 129, 1)",
        borderWidth: 1,
        borderRadius: 4,
        hoverBackgroundColor: "rgba(52, 211, 153, 0.8)", // Emerald 400
      }
    ]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: "#94a3b8",
          font: {
            size: 10,
          }
        }
      },
      y: {
        min: 0,
        max: 100,
        grid: {
          color: "rgba(51, 65, 85, 0.15)",
        },
        ticks: {
          color: "#94a3b8",
          callback: (value) => `${value}%`
        }
      }
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        titleColor: "#ffffff",
        bodyColor: "#cbd5e1",
        borderColor: "rgba(51, 65, 85, 0.5)",
        borderWidth: 1,
        padding: 8,
        cornerRadius: 6,
        callbacks: {
          label: (context) => `Ocupación: ${context.parsed.y}%`
        }
      }
    }
  };

  // 3. Multi-Bar Chart: Comparative Characteristics (Volume vs Weight vs Temp)
  const characteristicsData = {
    labels: containers.map(c => c.nombre || `Contenedor ${c.id}`),
    datasets: [
      {
        label: "Volumen (%)",
        data: containers.map(c => c.ia?.volumenPct ?? 0),
        backgroundColor: "rgba(16, 185, 129, 0.65)", // Emerald 500
        borderColor: "rgba(16, 185, 129, 1)",
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: "Peso (kg)",
        data: containers.map(c => c.ia?.pesoKg ?? c.ultimaLectura?.pesoKg ?? 0),
        backgroundColor: "rgba(14, 165, 233, 0.65)", // Sky 500
        borderColor: "rgba(14, 165, 233, 1)",
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: "Temperatura (°C)",
        data: containers.map(c => c.ia?.temperatura ?? c.ultimaLectura?.tempCelsius ?? 0),
        backgroundColor: "rgba(244, 63, 94, 0.65)", // Rose 500
        borderColor: "rgba(244, 63, 94, 1)",
        borderWidth: 1,
        borderRadius: 4,
      }
    ]
  };

  const characteristicsOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: "#94a3b8",
          font: {
            size: 10,
          }
        }
      },
      y: {
        grid: {
          color: "rgba(51, 65, 85, 0.15)",
        },
        ticks: {
          color: "#94a3b8",
        }
      }
    },
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: "#94a3b8",
          boxWidth: 12,
          font: {
            size: 11,
            weight: "600"
          }
        }
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        titleColor: "#ffffff",
        bodyColor: "#cbd5e1",
        borderColor: "rgba(51, 65, 85, 0.5)",
        borderWidth: 1,
        padding: 8,
        cornerRadius: 6,
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Dashboard Top Header & Simulation Button */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Resumen Operativo</h1>
          <p className="text-slate-400 text-sm mt-1">
            Estado en tiempo real del sistema inteligente de recolección de residuos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSimulate}
            disabled={simulating}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm tracking-wide shadow-lg transition-all duration-200 flex items-center gap-2 ${
              simulating
                ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 hover:scale-103 active:scale-97 cursor-pointer"
            }`}
          >
            {simulating ? (
              <>
                <svg className="animate-spin h-5 w-5 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Simulando...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                Simular Telemetría
              </>
            )}
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMsg && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 rounded-xl text-sm font-semibold flex items-center justify-between shadow-inner transition-all duration-300 animate-fadeIn">
          <div className="flex items-center gap-3">
            <span className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg("")}
            className="text-emerald-500 hover:text-emerald-400 font-bold px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Numerical Stats Cards */}
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

      {/* Main Charts & Visualizations Section */}
      {mounted && containers.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Doughnut Chart: Occupancy Distribution */}
          <div className="card backdrop-blur-md bg-opacity-70 flex flex-col justify-between min-h-[350px]">
            <div>
              <h3 className="text-lg font-bold text-white">Distribución de Ocupación</h3>
              <p className="text-slate-400 text-xs mt-1">Porcentaje de contenedores por nivel de llenado.</p>
            </div>
            <div className="relative flex-1 py-4 h-[220px]">
              <Doughnut data={doughnutData} options={doughnutOptions} />
            </div>
          </div>

          {/* Bar Chart: Individual Fill Levels */}
          <div className="card backdrop-blur-md bg-opacity-70 col-span-1 lg:col-span-2 flex flex-col justify-between min-h-[350px]">
            <div>
              <h3 className="text-lg font-bold text-white">Capacidad de Llenado Individual</h3>
              <p className="text-slate-400 text-xs mt-1">Nivel actual de ocupación (%) por cada contenedor inteligente.</p>
            </div>
            <div className="relative flex-1 py-4 h-[220px]">
              <Bar data={barData} options={barOptions} />
            </div>
          </div>

          {/* Grouped Bar Chart: Container Characteristics */}
          <div className="card backdrop-blur-md bg-opacity-70 col-span-1 lg:col-span-3 flex flex-col justify-between min-h-[400px]">
            <div>
              <h3 className="text-lg font-bold text-white">Características Físicas de Contenedores</h3>
              <p className="text-slate-400 text-xs mt-1">
                Comparativa de volumen de ocupación (%), peso cargado (kg), y temperatura ambiental (°C).
              </p>
            </div>
            <div className="relative flex-1 py-4 h-[280px]">
              <Bar data={characteristicsData} options={characteristicsOptions} />
            </div>
          </div>
        </div>
      ) : (
        <div className="card backdrop-blur-md bg-opacity-70 p-8 text-center text-slate-400">
          No hay suficientes datos de contenedores para mostrar las gráficas interactivos. ¡Haz clic en "Simular Telemetría" arriba para poblar el sistema!
        </div>
      )}

      {/* Operating Suggestions Box */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card backdrop-blur-md bg-opacity-70 col-span-1 lg:col-span-2 space-y-6">
          <h3 className="text-xl font-bold text-white">Resumen General de Ocupación</h3>
          
          <div className="flex flex-col md:flex-row items-center gap-8 py-4">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" stroke="#1e293b" strokeWidth="8" fill="transparent" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="#10b981"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 40}
                  strokeDashoffset={2 * Math.PI * 40 * (1 - (stats?.avgVolume ?? 0) / 100)}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-extrabold text-white">{stats?.avgVolume ?? 0}%</span>
                <span className="text-slate-500 text-[9px] uppercase font-bold tracking-wider">Promedio</span>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <h4 className="text-md font-semibold text-slate-200">Capacidad Total de Almacenamiento</h4>
                <p className="text-slate-400 text-sm mt-1">
                  El nivel promedio de llenado de todos los contenedores evaluados por IA se encuentra en un <span className="text-emerald-400 font-bold">{stats?.avgVolume ?? 0}%</span>.
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

        {/* AI Recommendations */}
        <div className="card backdrop-blur-md bg-opacity-70 bg-gradient-to-br from-slate-900/90 to-emerald-950/10 border border-slate-700/50 flex flex-col justify-between">
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
            className="w-full btn-primary text-center block mt-6 text-sm py-2 text-slate-950 font-bold"
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
      className={`card flex items-center justify-between backdrop-blur-md bg-opacity-70 hover:border-slate-500 transition-all duration-200 ${
        highlight ? "border-rose-500/40 bg-rose-950/10 animate-pulse" : ""
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
