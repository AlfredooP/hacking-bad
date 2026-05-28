"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

const NAV = [
  { href: "/dashboard", label: "Resumen" },
  { href: "/dashboard/mapa", label: "Mapa" },
  { href: "/dashboard/camiones", label: "Flota de Camiones" },
];

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    api
      .me()
      .then((d) => setUser(d.user))
      .catch(() => router.replace("/login"));
  }, [router]);

  async function handleLogout() {
    await api.logout().catch(() => {});
    router.replace("/login");
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Cargando…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-green-400">BIN NEXT</span>
          <nav className="flex gap-4 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  pathname === item.href ? "text-green-400" : "text-slate-400 hover:text-white"
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-400">{user.nombre}</span>
          <button onClick={handleLogout} className="text-slate-400 hover:text-white">
            Salir
          </button>
        </div>
      </header>
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
