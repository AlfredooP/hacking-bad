"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { filterNavForRole, isAdminRole } from "@/lib/navigation";
import { BrandLogo } from "./BrandLogo";

const ICONS = {
  chart: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  ),
  map: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  ),
  bin: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  ),
  region: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  ),
  truck: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10M21 16V10a1 1 0 00-1-1h-7m8 7H13" />
  ),
};

export function DashboardShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Cargando ATLAS WASTE…</span>
        </div>
      </div>
    );
  }

  const navGroups = filterNavForRole(user.rol);
  const admin = isAdminRole(user.rol);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)]">
      {/* Header fijo */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-md">
        <div className="h-full px-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label="Menú"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <BrandLogo size="sm" href="/dashboard" />
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {admin && (
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                Admin
              </span>
            )}
            <span className="text-sm text-slate-400 truncate max-w-[120px] sm:max-w-none">{user.nombre}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 pt-14">
        {/* Overlay móvil */}
        {sidebarOpen && (
          <button
            type="button"
            className="lg:hidden fixed inset-0 z-40 bg-black/50 pt-14"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed lg:sticky top-14 z-40 h-[calc(100vh-3.5rem)] w-64 shrink-0
            border-r border-slate-800/80 bg-slate-950/98 backdrop-blur-md
            flex flex-col overflow-y-auto transition-transform duration-200
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}
        >
          <nav className="p-4 space-y-6 flex-1">
            {navGroups.map((group) => (
              <div key={group.id}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-2 mb-2">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={`
                            flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                            ${active
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                              : "text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent"
                            }
                          `}
                        >
                          <svg className="w-5 h-5 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {ICONS[item.icon]}
                          </svg>
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-800 text-[10px] text-slate-600">
            ATLAS WASTE © {new Date().getFullYear()}
          </div>
        </aside>

        {/* Contenido principal */}
        <main className="flex-1 min-w-0 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
