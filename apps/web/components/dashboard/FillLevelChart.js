"use client";

import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: "bottom",
      labels: { color: "#94a3b8", boxWidth: 12, padding: 16 },
    },
    tooltip: {
      backgroundColor: "#1a2332",
      borderColor: "#334155",
      borderWidth: 1,
      titleColor: "#e2e8f0",
      bodyColor: "#94a3b8",
    },
  },
  scales: {
    x: {
      ticks: { color: "#64748b", maxRotation: 45, minRotation: 45, font: { size: 10 } },
      grid: { display: false },
    },
    y: {
      min: 0,
      max: 100,
      ticks: { color: "#64748b", stepSize: 20 },
      grid: { color: "rgba(51, 65, 85, 0.5)" },
    },
  },
};

export default function FillLevelChart({ items = [] }) {
  const labels = items.map((i) => i.label);
  const data = {
    labels,
    datasets: [
      {
        label: "Llenado (%)",
        data: items.map((i) => i.value),
        backgroundColor: "rgba(59, 130, 246, 0.85)",
        borderRadius: 4,
        borderSkipped: false,
      },
    ],
  };

  return (
    <div className="card h-full flex flex-col">
      <h2 className="text-xs font-semibold tracking-widest text-slate-400 mb-4">
        PORCENTAJE DE LLENADO
      </h2>
      <div className="flex-1 min-h-[240px]">
        {items.length > 0 ? (
          <Bar data={data} options={chartOptions} />
        ) : (
          <p className="text-slate-500 text-sm text-center py-16">Sin datos de llenado</p>
        )}
      </div>
    </div>
  );
}
