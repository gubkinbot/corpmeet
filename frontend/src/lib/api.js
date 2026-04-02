import { storage } from "./storage";

const BASE = "/api";

export async function apiFetch(path, options = {}) {
  const token = storage.getToken();
  const headers = { ...options.headers };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    storage.removeToken();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  return res;
}
