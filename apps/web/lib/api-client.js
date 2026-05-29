const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost/api";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}/v1${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data;
}

export const api = {
  login: (email, password) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (nombre, email, password) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ nombre, email, password }),
    }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),
  containersMap: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.zona) qs.set("zona", params.zona);
    if (params.tipoResiduo) qs.set("tipoResiduo", params.tipoResiduo);
    if (params.prioridad) qs.set("prioridad", params.prioridad);
    if (params.soloContaminacion) qs.set("soloContaminacion", "true");
    const q = qs.toString();
    return request(`/containers/map${q ? `?${q}` : ""}`);
  },
  containersList: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.zona) qs.set("zona", params.zona);
    if (params.tipoResiduo) qs.set("tipoResiduo", params.tipoResiduo);
    if (params.prioridad) qs.set("prioridad", params.prioridad);
    if (params.soloContaminacion) qs.set("soloContaminacion", "true");
    const q = qs.toString();
    return request(`/containers${q ? `?${q}` : ""}`);
  },
  containerGet: (id) => request(`/containers/${id}`),
  containerCreate: (data) =>
    request("/containers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  containerDelete: (id) =>
    request(`/containers/${id}`, {
      method: "DELETE",
    }),
  containerAlerts: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.resueltas === true) qs.set("resueltas", "true");
    if (params.resueltas === false) qs.set("resueltas", "false");
    const q = qs.toString();
    return request(`/containers/alerts${q ? `?${q}` : ""}`);
  },
  containerAlertResolve: (id) =>
    request(`/containers/alerts/${id}/resolve`, { method: "PATCH" }),
  dashboardStats: () => request("/containers/stats"),
  containerUpdate: (id, data) =>
    request(`/containers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  trucksList: () => request("/trucks"),
  truckCreate: (data) =>
    request("/trucks", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  truckUpdate: (id, data) =>
    request(`/trucks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  truckDelete: (id) =>
    request(`/trucks/${id}`, {
      method: "DELETE",
    }),
  aiOptimizeRoute: () =>
    request("/ai/optimize-route", {
      method: "POST",
    }),
};
