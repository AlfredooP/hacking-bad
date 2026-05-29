"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { isAdminRole } from "@/lib/navigation";

const MapDashboard = dynamic(() => import("@/components/MapDashboard"), {
  ssr: false,
  loading: () => (
    <div className="h-[calc(100vh-8rem)] flex items-center justify-center text-slate-400">
      Cargando mapa ATLAS WASTE…
    </div>
  ),
});

export default function MapaPage() {
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    api.me().then((d) => setCanManage(isAdminRole(d.user?.rol))).catch(() => {});
  }, []);

  return (
    <div className="space-y-4 -m-2 lg:-m-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">Mapa interactivo</h1>
        <p className="text-slate-400 text-sm mt-1">
          Regiones, zonas, contenedores y flota en tiempo real.
          {!canManage && " Modo consulta (solo lectura)."}
        </p>
      </div>
      <MapDashboard canManage={canManage} />
    </div>
  );
}
