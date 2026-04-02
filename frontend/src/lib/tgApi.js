const BASE = "/api";
const TOKEN_KEY = "corpmeet_tg_token";

export const getTgToken = () => localStorage.getItem(TOKEN_KEY);
export const setTgToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearTgToken = () => localStorage.removeItem(TOKEN_KEY);

function apiFetch(path, opts = {}) {
  const token = getTgToken();
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  }).then(async r => {
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.detail || String(r.status));
    }
    if (r.status === 204) return null;
    return r.json();
  });
}

export const tgLogin    = (initData) => apiFetch("/auth/login",    { method: "POST", body: JSON.stringify({ init_data: initData }) });
export const tgRegister = (initData, firstName, lastName = "") =>
  apiFetch("/auth/register", { method: "POST", body: JSON.stringify({ init_data: initData, first_name: firstName, last_name: lastName }) });

export const getMe             = ()        => apiFetch("/users/me");
export const getRooms          = ()        => apiFetch("/rooms/");
export const getRoomsStatus    = ()        => apiFetch("/rooms/status");
export const getActiveBookings = ()        => apiFetch("/bookings/active");
export const createTgBooking   = (payload) => apiFetch("/bookings/", { method: "POST", body: JSON.stringify(payload) });
export const deleteTgBooking   = (id)      => apiFetch(`/bookings/${id}`, { method: "DELETE" });
