"use client";

import { Chart as ChartJS, ArcElement, Legend, Tooltip } from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

const COLORS = {
  alta: "#ef4444",
  media: "#f59e0b",
  normal: "#10b981",
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: "65%",
  plugins: {
    legend: {
      position: "bottom",
      labels: {
        color: "#94a3b8",
        padding: 16,
        usePointStyle: true,
        pointStyle: "rect",
      },
    },
    tooltip: {
      backgroundColor: "#1a2332",
      borderColor: "#334155",
      borderWidth: 1,
      titleColor: "#e2e8f0",
      bodyColor: "#94a3b8",
    },
  },
};

export default function PriorityDonutChart({ prioridades = {} }) {
  const alta = prioridades.alta ?? 0;
  const media = prioridades.media ?? 0;
  const normal = prioridades.normal ?? 0;
  const total = alta + media + normal;

  const data = {
    labels: ["ALTA", "MEDIA", "NORMAL"],
    datasets: [
      {
        data: [alta, media, normal],
        backgroundColor: [COLORS.alta, COLORS.media, COLORS.normal],
        borderWidth: 0,
        hoverOffset: 6,
      },
    ],
  };

  return (
    <div className="card h-full flex flex-col">
      <h2 className="text-xs font-semibold tracking-widest text-slate-400 mb-4">
        ESTADOS DE LOS CONTENEDORES
      </h2>
      <div className="flex-1 min-h-[240px] flex items-center justify-center">
        {total > 0 ? (
          <div className="w-full max-w-[280px] aspect-square">
            <Doughnut data={data} options={chartOptions} />
          </div>
        ) : (
          <p className="text-slate-500 text-sm text-center py-16">Sin clasificación IA</p>
        )}
      </div>
    </div>
  );
}
