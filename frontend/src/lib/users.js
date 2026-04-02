import { apiFetch } from "./api";

export async function searchUsers(q) {
  const res = await apiFetch(`/users/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  return res.json();
}

export async function getFeedToken() {
  const res = await apiFetch("/users/feed-token", { method: "POST" });
  if (!res.ok) throw new Error("Failed to get feed token");
  return res.json();
}

export async function getRooms() {
  const res = await apiFetch("/rooms/");
  if (!res.ok) throw new Error("Failed to fetch rooms");
  return res.json();
}

export async function getAdminUsers() {
  const res = await apiFetch("/users/admin/users");
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export async function getAdminStats() {
  const res = await apiFetch("/users/admin/stats");
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

export async function createAdminUser(payload) {
  const res = await apiFetch("/users/admin/users", { method: "POST", body: payload });
  if (!res.ok) throw new Error("Failed to create user");
  return res.json();
}

export async function deleteAdminUser(id) {
  const res = await apiFetch(`/users/admin/users/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete user");
  return res.json();
}

export async function changeUserRole(id, role) {
  const res = await apiFetch(`/users/admin/users/${id}/role`, { method: "PATCH", body: { role } });
  if (!res.ok) throw new Error("Failed to change role");
  return res.json();
}

export async function assignUserRoom(id, roomId) {
  const res = await apiFetch(`/users/admin/users/${id}/room`, { method: "PATCH", body: { room_id: roomId || null } });
  if (!res.ok) throw new Error("Failed to assign room");
  return res.json();
}

export function setAdminRooms(id, roomIds) {
  return apiFetch(`/users/admin/users/${id}/allowed-rooms`, {
    method: "PATCH",
    body: { room_ids: roomIds },
  });
}
