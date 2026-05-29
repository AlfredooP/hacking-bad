/** Navegación del panel — filtrada por rol en DashboardShell */

export const NAV_GROUPS = [
  {
    id: "general",
    label: "Operaciones",
    roles: ["admin", "usuario", "user", "operador"],
    items: [
      { href: "/dashboard", label: "Resumen", icon: "chart" },
      { href: "/dashboard/mapa", label: "Mapa interactivo", icon: "map" },
    ],
  },
  {
    id: "admin",
    label: "Administración",
    roles: ["admin"],
    items: [
      { href: "/dashboard/admin/contenedores", label: "Contenedores", icon: "bin" },
      { href: "/dashboard/admin/regiones", label: "Regiones y zonas", icon: "region" },
      { href: "/dashboard/admin/camiones", label: "Flota de camiones", icon: "truck" },
    ],
  },
];

export function isAdminRole(rol) {
  return String(rol || "").toLowerCase() === "admin";
}

export function filterNavForRole(rol) {
  const r = String(rol || "usuario").toLowerCase();
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.roles.some((allowed) => allowed === r || (allowed === "usuario" && r === "user"))
      ? g.items
      : [],
  })).filter((g) => g.items.length > 0);
}
