import { apiFetch } from "./api";

export async function getBookings(dateFrom, dateTo) {
  const params = new URLSearchParams({ date_from: dateFrom });
  if (dateTo) params.append("date_to", dateTo);
  const res = await apiFetch(`/bookings/?${params}`);
  if (!res.ok) throw new Error("Failed to fetch bookings");
  return res.json();
}

function extractDetail(err) {
  const d = err.detail;
  if (!d) return null;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map(e => e.msg || JSON.stringify(e)).join("; ");
  return JSON.stringify(d);
}

export async function createBooking(payload) {
  const res = await apiFetch("/bookings/", { method: "POST", body: payload });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(extractDetail(err) || "Ошибка создания бронирования");
  }
  return res.json();
}

export async function updateBooking(id, payload) {
  const res = await apiFetch(`/bookings/${id}`, { method: "PATCH", body: payload });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(extractDetail(err) || "Ошибка обновления бронирования");
  }
  return res.json();
}

export async function deleteBooking(id, deleteSeries = false) {
  const params = deleteSeries ? "?delete_series=true" : "";
  const res = await apiFetch(`/bookings/${id}${params}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete booking");
  return res.json();
}

export async function getActiveBookings() {
  const res = await apiFetch("/bookings/active");
  if (!res.ok) throw new Error("Failed to fetch active bookings");
  return res.json();
}

export async function exportBookings() {
  const res = await apiFetch("/bookings/export");
  if (!res.ok) throw new Error("Failed to export");
  return res.blob();
}

export async function getAdminBookings() {
  const res = await apiFetch("/bookings/admin/all");
  if (!res.ok) throw new Error("Failed to fetch admin bookings");
  return res.json();
}
