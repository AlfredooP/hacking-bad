"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

const MapDashboard = dynamic(() => import("@/components/MapDashboard"), {
  ssr: false,
  loading: () => <p className="text-slate-400">Cargando mapa…</p>,
});

export default function MapaPage() {
  const [containers, setContainers] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .containersMap()
      .then((d) => setContainers(d.containers))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Mapa de contenedores</h1>
      {error && <p className="text-red-400 mb-4">{error}</p>}
      {containers.length > 0 ? (
        <MapDashboard containers={containers} />
      ) : (
        !error && <p className="text-slate-400">Cargando contenedores…</p>
      )}
    </div>
  );
}
