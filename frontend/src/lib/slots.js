import { apiFetch } from "./api";

export async function getSlots(date, roomId) {
  const params = new URLSearchParams({ date });
  if (roomId) params.append("room_id", roomId);
  const res = await apiFetch(`/slots/?${params}`);
  if (!res.ok) throw new Error("Failed to fetch slots");
  return res.json();
}
