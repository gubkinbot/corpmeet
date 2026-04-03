import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAdminUsers, useAdminStats, useCreateAdminUser, useDeleteAdminUser, useChangeUserRole, useAssignUserRoom, useSetAdminRooms } from "../../hooks/useUsers";
import { useRooms } from "../../hooks/useUsers";
import { useAdminBookings } from "../../hooks/useBookings";

function fmt(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AdminPanel({ isOpen, onClose, currentUser }) {
  const [tab, setTab] = useState("stats");
  const [newName, setNewName] = useState("");
  const [newLastName, setNewLastName] = useState("");

  const { data: stats } = useAdminStats();
  const { data: users = [] } = useAdminUsers();
  const { data: bookings = [] } = useAdminBookings();
  const { data: rooms = [] } = useRooms();
  const createUser = useCreateAdminUser();
  const deleteUser = useDeleteAdminUser();
  const changeRole = useChangeUserRole();
  const assignRoom = useAssignUserRoom();
  const setAdminRooms = useSetAdminRooms();

  const isSuperadmin = currentUser?.role === "superadmin";

  const handleCreateUser = async () => {
    if (!newName.trim()) return;
    await createUser.mutateAsync({ first_name: newName, last_name: newLastName });
    setNewName("");
    setNewLastName("");
  };

  const tabs = [
    { id: "stats", label: "Статистика" },
    { id: "bookings", label: "Бронирования" },
    { id: "users", label: "Пользователи" },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-30" onClick={onClose} />
          <motion.div
            initial={{ x: 400, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", damping: 24, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-40 w-96 flex flex-col"
            style={{ background: "var(--panel)", borderLeft: "1px solid var(--border)", boxShadow: "var(--panel-shadow)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <h3 className="text-sm font-bold" style={{ color: "var(--text)" }}>Администрирование</h3>
              <button onClick={onClose} className="text-sm" style={{ color: "var(--text-muted)" }}>✕</button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-4 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={tab === t.id
                    ? { background: "var(--primary)", color: "white" }
                    : { color: "var(--text-muted)" }}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">

              {/* Stats */}
              {tab === "stats" && stats && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Пользователей", value: stats.total_users },
                    { label: "Бронирований", value: stats.total_bookings },
                    { label: "Активных", value: stats.active_bookings },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-3 text-center"
                      style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}>
                      <div className="text-2xl font-bold" style={{ color: "var(--primary)" }}>{s.value}</div>
                      <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Bookings */}
              {tab === "bookings" && (
                <div className="flex flex-col gap-2">
                  {bookings.length === 0 && (
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>Нет бронирований</p>
                  )}
                  {bookings.map(b => (
                    <div key={b.id} className="rounded-xl p-3"
                      style={{ background: "var(--elevated)", border: "1px solid var(--border-light)" }}>
                      <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>{b.title}</div>
                      <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                        {fmt(b.start_time)} – {fmt(b.end_time)}
                      </div>
                      {b.user && (
                        <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {b.user.first_name} {b.user.last_name || ""}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Users */}
              {tab === "users" && (
                <div className="flex flex-col gap-3">
                  {/* Create user form */}
                  <div className="flex gap-2">
                    <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Имя"
                      className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text)" }} />
                    <input value={newLastName} onChange={e => setNewLastName(e.target.value)} placeholder="Фамилия"
                      className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text)" }} />
                    <button onClick={handleCreateUser} className="px-3 py-2 rounded-xl text-sm font-bold text-white"
                      style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}>+</button>
                  </div>

                  {/* User list */}
                  {users.map(u => (
                    <div key={u.id} className="rounded-xl p-3"
                      style={{ background: "var(--elevated)", border: "1px solid var(--border-light)" }}>
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}>
                          {u.first_name?.[0]?.toUpperCase()}
                        </div>

                        {/* Name + role */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
                            {u.first_name} {u.last_name || ""}
                          </div>
                          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {u.role}{u.username ? ` · @${u.username}` : ""}
                          </div>
                        </div>

                        {/* Role selector (superadmin only) */}
                        {isSuperadmin && u.id !== currentUser.id && (
                          <select
                            value={u.role}
                            onChange={e => changeRole.mutate({ id: u.id, role: e.target.value })}
                            className="text-xs px-2 py-1 rounded-lg outline-none"
                            style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text)" }}>
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                            <option value="superadmin">superadmin</option>
                          </select>
                        )}

                        {/* Delete */}
                        {u.id !== currentUser.id && (
                          <button onClick={() => { if (confirm("Удалить пользователя?")) deleteUser.mutate(u.id); }}
                            className="text-xs px-2 py-1 rounded-lg shrink-0"
                            style={{ color: "var(--danger)" }}>✕</button>
                        )}
                      </div>

                      {/* Room assignment (checkboxes for all non-superadmin roles) */}
                      {isSuperadmin && rooms.length > 0 && u.role !== "superadmin" && (
                        <div className="mt-2.5">
                          <span className="text-xs mb-1.5 block" style={{ color: "var(--text-muted)" }}>Доступные комнаты:</span>
                          <div className="flex flex-col gap-1">
                            {rooms.map(r => {
                              const allowed = u.allowed_rooms || [];
                              const checked = allowed.includes(r.id) || allowed.includes(String(r.id));
                              return (
                                <label key={r.id} className="flex items-center gap-2 text-xs cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={e => {
                                      const current = (u.allowed_rooms || []).map(String);
                                      const rid = String(r.id);
                                      const next = e.target.checked
                                        ? [...current, rid]
                                        : current.filter(x => x !== rid);
                                      setAdminRooms.mutate({ id: u.id, roomIds: next });
                                    }}
                                    className="rounded"
                                  />
                                  <span style={{ color: "var(--text-sec)" }}>{r.name} (эт. {r.floor})</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
