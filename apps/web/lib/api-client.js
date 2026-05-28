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
  containersMap: () => request("/containers/map"),
  dashboardStats: () => request("/containers/stats"),
};
