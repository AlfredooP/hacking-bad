"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

const MapDashboard = dynamic(() => import("@/components/MapDashboard"), {
  ssr: false,
  loading: () => <p className="text-slate-400">Cargando mapa…</p>,
});

export default function MapaPage() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Mapa de Contenedores</h1>
          <p className="text-slate-400 text-sm mt-1">
            Monitorea y simula rutas óptimas de recolección en tiempo real.
          </p>
        </div>
      </div>
      <MapDashboard />
    </div>
  );
}
