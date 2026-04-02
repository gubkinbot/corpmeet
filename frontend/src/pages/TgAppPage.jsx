import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../contexts/ThemeContext";
import {
  getTgToken, setTgToken, clearTgToken,
  tgLogin, tgRegister, getMe, getRooms,
  getRoomsStatus, getActiveBookings, createTgBooking, deleteTgBooking,
} from "../lib/tgApi";

// ── Telegram SDK helpers ──────────────────────────────────────────────────────
const tgApp  = () => window.Telegram?.WebApp;
const initData = () => tgApp()?.initData || "";
const tgUser  = () => tgApp()?.initDataUnsafe?.user;

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
function fmtLocal(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const p = n => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth()+1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ── Booking card ──────────────────────────────────────────────────────────────
function BookingCard({ booking, onCancel, isDark }) {
  const [confirming, setConfirming] = useState(false);
  const isPast = new Date(booking.end_time) < new Date();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      style={{
        borderRadius: 16,
        padding: "1rem",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: isDark ? "0 2px 12px rgba(0,0,0,0.25)" : "0 2px 8px rgba(0,0,0,0.06)",
        opacity: isPast ? 0.55 : 1,
      }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text)", margin: 0, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {booking.title}
          </p>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 3 }}>
            {fmtDate(booking.start_time)} · {fmtTime(booking.start_time)}–{fmtTime(booking.end_time)}
          </p>
        </div>
        {!isPast && !confirming && (
          <button onClick={() => setConfirming(true)}
            style={{ flexShrink: 0, padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.08)", color: "var(--danger)", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}>
            Отмена
          </button>
        )}
        {confirming && (
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button onClick={() => onCancel(booking.id)}
              style={{ padding: "4px 10px", borderRadius: 8, background: "var(--danger)", color: "#fff", border: "none", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}>
              Да
            </button>
            <button onClick={() => setConfirming(false)}
              style={{ padding: "4px 10px", borderRadius: 8, background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--text-muted)", fontSize: "0.75rem", cursor: "pointer" }}>
              Нет
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Room status card ──────────────────────────────────────────────────────────
function RoomStatusCard({ room, isDark }) {
  const busy = !!room.current_booking;
  const color = busy ? "var(--danger)" : (isDark ? "#34d399" : "#059669");
  const bg    = busy ? "rgba(220,38,38,0.07)" : "rgba(5,150,105,0.07)";
  const border = busy ? "rgba(220,38,38,0.25)" : "rgba(5,150,105,0.25)";

  return (
    <div style={{ borderRadius: 16, padding: "0.9rem 1rem", background: "var(--surface)", border: `1.5px solid ${border}`, boxShadow: isDark ? "0 2px 10px rgba(0,0,0,0.2)" : "0 1px 6px rgba(0,0,0,0.05)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text)", margin: 0 }}>{room.name}</p>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>Эт. {room.floor} · {room.capacity} мест</p>
        </div>
        <span style={{ padding: "3px 12px", borderRadius: 99, fontSize: "0.75rem", fontWeight: 700, color, background: bg, border: `1px solid ${border}` }}>
          {busy ? "Занята" : "Свободна"}
        </span>
      </div>
      {busy && (
        <div style={{ marginTop: 8, padding: "0.5rem 0.75rem", borderRadius: 10, background: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.1)" }}>
          <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text)", margin: 0 }}>{room.current_booking.title}</p>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
            до {fmtTime(room.current_booking.end_time)}
          </p>
        </div>
      )}
      {room.next_booking && (
        <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 6, margin: "6px 0 0" }}>
          Далее: {fmtTime(room.next_booking.start_time)} · {room.next_booking.title}
        </p>
      )}
    </div>
  );
}

// ── Create booking form ───────────────────────────────────────────────────────
function CreateForm({ rooms, onSuccess, onError, isDark }) {
  const now = new Date();
  const roundedStart = new Date(Math.ceil(now / (30*60000)) * 30*60000);
  const roundedEnd   = new Date(roundedStart.getTime() + 60*60000);

  const [title, setTitle]       = useState("");
  const [roomId, setRoomId]     = useState(rooms[0]?.id || "");
  const [startTime, setStart]   = useState(fmtLocal(roundedStart));
  const [endTime, setEnd]       = useState(fmtLocal(roundedEnd));
  const [loading, setLoading]   = useState(false);

  const inputStyle = {
    width: "100%", padding: "0.75rem 1rem", borderRadius: 12, fontSize: "0.9rem",
    background: "var(--input-bg)", border: "1.5px solid var(--input-border)",
    color: "var(--text)", outline: "none",
  };

  const handleSubmit = async () => {
    if (!title.trim()) return onError("Введите название");
    if (!roomId) return onError("Выберите переговорную");
    const s = new Date(startTime), e = new Date(endTime);
    if (e - s < 15*60000) return onError("Минимум 15 минут");
    setLoading(true);
    try {
      await createTgBooking({ room_id: roomId, title, start_time: s.toISOString(), end_time: e.toISOString(), description: "", guests: [], recurrence: "none" });
      setTitle("");
      onSuccess("✅ Встреча забронирована");
    } catch(err) {
      onError(err.message || "Ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
      <div>
        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Название *</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Планёрка, Demo, 1:1..."
          style={inputStyle} />
      </div>
      <div>
        <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Переговорная</label>
        <select value={roomId} onChange={e => setRoomId(e.target.value)} style={inputStyle}>
          {rooms.map(r => <option key={r.id} value={r.id}>{r.name} (эт. {r.floor})</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <div>
          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Начало</label>
          <input type="datetime-local" value={startTime} onChange={e => setStart(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Конец</label>
          <input type="datetime-local" value={endTime} onChange={e => setEnd(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <button onClick={handleSubmit} disabled={loading}
        style={{
          padding: "0.875rem", borderRadius: 14, border: "none", cursor: "pointer",
          background: "linear-gradient(135deg,#7c3aed,#a855f7)",
          color: "#fff", fontSize: "0.95rem", fontWeight: 700,
          boxShadow: "0 4px 16px rgba(124,58,237,0.3)",
          opacity: loading ? 0.6 : 1,
        }}>
        {loading ? "Бронирование..." : "Забронировать"}
      </button>
    </div>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────────
function TgMain({ user, onLogout }) {
  const { isDark } = useTheme();
  const [tab, setTab]         = useState("bookings");
  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms]     = useState([]);
  const [status, setStatus]   = useState([]);
  const [toast, setToast]     = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadBookings = useCallback(() =>
    getActiveBookings().then(setBookings).catch(() => {}), []);
  const loadRooms    = useCallback(() =>
    getRooms().then(setRooms).catch(() => {}), []);
  const loadStatus   = useCallback(() =>
    getRoomsStatus().then(setStatus).catch(() => {}), []);

  useEffect(() => { loadBookings(); loadRooms(); loadStatus(); }, []);

  useEffect(() => {
    if (tab === "bookings") loadBookings();
    if (tab === "rooms")    loadStatus();
  }, [tab]);

  const handleCancel = async (id) => {
    try {
      await deleteTgBooking(id);
      setBookings(bs => bs.filter(b => b.id !== id));
      showToast("🗑 Встреча отменена");
    } catch(e) {
      showToast(e.message || "Ошибка", "error");
    }
  };

  const TABS = [
    { id: "bookings", label: "Встречи",   icon: "📅" },
    { id: "rooms",    label: "Комнаты",   icon: "🏢" },
    { id: "create",   label: "Создать",   icon: "➕" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg)" }}>

      {/* Header */}
      <div style={{
        padding: "0.85rem 1rem 0.75rem",
        background: "var(--header)", borderBottom: "1px solid var(--border)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <p style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text)" }}>
            Привет, {user.first_name} 👋
          </p>
          <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>
            {user.role === "superadmin" ? "Суперадмин" : user.role === "admin" ? "Администратор" : "Пользователь"}
          </p>
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "linear-gradient(135deg,#7c3aed,#a855f7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.9rem", fontWeight: 800, color: "#fff",
        }}>
          {user.first_name?.[0]?.toUpperCase()}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "auto", padding: "1rem" }}>
        <AnimatePresence mode="wait">
          {tab === "bookings" && (
            <motion.div key="bookings" initial={{ opacity:0, x:-12 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:12 }}>
              <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                Мои встречи ({bookings.length})
              </p>
              {bookings.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-muted)" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>📭</div>
                  <p style={{ fontSize: "0.9rem" }}>Нет запланированных встреч</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <AnimatePresence>
                    {bookings.map(b => (
                      <BookingCard key={b.id} booking={b} onCancel={handleCancel} isDark={isDark} />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )}

          {tab === "rooms" && (
            <motion.div key="rooms" initial={{ opacity:0, x:-12 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:12 }}>
              <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                Состояние комнат
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {status.map(r => <RoomStatusCard key={r.id} room={r} isDark={isDark} />)}
              </div>
            </motion.div>
          )}

          {tab === "create" && (
            <motion.div key="create" initial={{ opacity:0, x:-12 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:12 }}>
              <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                Новое бронирование
              </p>
              <CreateForm
                rooms={rooms}
                isDark={isDark}
                onSuccess={msg => { showToast(msg); setTab("bookings"); loadBookings(); }}
                onError={msg => showToast(msg, "error")}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom tab bar */}
      <div style={{
        display: "flex", borderTop: "1px solid var(--border)",
        background: "var(--header)", paddingBottom: "env(safe-area-inset-bottom, 0)",
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: "0.75rem 0.5rem 0.65rem", border: "none", cursor: "pointer",
              background: "transparent",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              color: tab === t.id ? "var(--primary)" : "var(--text-muted)",
              transition: "color 0.15s",
            }}>
            <span style={{ fontSize: "1.25rem", lineHeight: 1 }}>{t.icon}</span>
            <span style={{ fontSize: "0.65rem", fontWeight: tab === t.id ? 700 : 500 }}>{t.label}</span>
            {tab === t.id && (
              <motion.div layoutId="tabIndicator"
                style={{ position: "absolute", bottom: 0, width: 28, height: 3, borderRadius: 99, background: "var(--primary)" }} />
            )}
          </button>
        ))}
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{
              position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
              padding: "0.6rem 1.25rem", borderRadius: 12, fontSize: "0.85rem", fontWeight: 600,
              color: "#fff", zIndex: 99, whiteSpace: "nowrap",
              background: toast.type === "error" ? "var(--danger)" : "var(--success)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Registration form ─────────────────────────────────────────────────────────
function RegisterForm({ onRegistered }) {
  const tg = tgUser();
  const [firstName, setFirst] = useState(tg?.first_name || "");
  const [lastName, setLast]   = useState(tg?.last_name  || "");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const handleRegister = async () => {
    if (!firstName.trim()) return setError("Введите имя");
    if (!lastName.trim())  return setError("Введите фамилию");
    setLoading(true);
    try {
      const res = await tgRegister(initData(), firstName, lastName);
      setTgToken(res.access_token);
      onRegistered();
    } catch(e) {
      setError(e.message || "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "0.75rem 1rem", borderRadius: 12, fontSize: "0.9rem",
    background: "var(--input-bg)", border: "1.5px solid rgba(37,99,235,0.2)",
    color: "var(--text)", outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem", position: "relative", overflow: "hidden" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
        style={{ width: "100%", maxWidth: 420, position: "relative" }}>

        {/* Glow */}
        <div style={{ position: "absolute", inset: -32, borderRadius: 24, pointerEvents: "none", background: "radial-gradient(ellipse, rgba(37,99,235,0.16) 0%, transparent 70%)", filter: "blur(20px)" }} />

        {/* Card */}
        <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", background: "var(--surface)", border: "1px solid rgba(37,99,235,0.2)", boxShadow: "var(--card-shadow), 0 0 0 1px rgba(99,102,241,0.07)", backdropFilter: "blur(var(--glass-blur))" }}>

          {/* Top gradient line */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(37,99,235,0.7), rgba(99,102,241,0.5), transparent)" }} />

          {/* Corner decorations */}
          {[
            { top: 0, left: 0,    borderTop: "1px solid rgba(37,99,235,0.35)",    borderLeft:   "1px solid rgba(37,99,235,0.35)" },
            { top: 0, right: 0,   borderTop: "1px solid rgba(37,99,235,0.35)",    borderRight:  "1px solid rgba(37,99,235,0.35)" },
            { bottom: 0, left: 0, borderBottom: "1px solid rgba(37,99,235,0.35)", borderLeft:   "1px solid rgba(37,99,235,0.35)" },
            { bottom: 0, right: 0,borderBottom: "1px solid rgba(37,99,235,0.35)", borderRight:  "1px solid rgba(37,99,235,0.35)" },
          ].map((pos, i) => (
            <div key={i} style={{ position: "absolute", width: 20, height: 20, ...pos }} />
          ))}

          <div style={{ padding: "2.5rem 2.5rem 2rem" }}>
            {/* Logo */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "1.75rem", gap: 12 }}>
              <div style={{ position: "relative", padding: "1rem", borderRadius: 16, background: "linear-gradient(135deg,rgba(37,99,235,0.07),rgba(99,102,241,0.04))", border: "1px solid rgba(37,99,235,0.12)" }}>
                <motion.div animate={{ opacity: [0.3, 0.75, 0.3] }} transition={{ duration: 2.5, repeat: Infinity }}
                  style={{ position: "absolute", inset: -12, borderRadius: 24, background: "radial-gradient(ellipse,rgba(37,99,235,0.22) 0%,transparent 70%)", filter: "blur(8px)", pointerEvents: "none" }} />
                <img src="/UZINFOCOM_logo.png" alt="UZINFOCOM" style={{ position: "relative", height: 48, objectFit: "contain", display: "block" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ height: 1, width: 40, background: "linear-gradient(90deg,transparent,rgba(37,99,235,0.35))" }} />
                <span style={{ color: "rgba(37,99,235,0.9)", fontSize: 15, letterSpacing: "0.18em", fontWeight: 800 }}>CORPMEET</span>
                <div style={{ height: 1, width: 40, background: "linear-gradient(90deg,rgba(37,99,235,0.35),transparent)" }} />
              </div>
            </div>

            <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              style={{ fontSize: "1.4rem", fontWeight: 700, textAlign: "center", color: "var(--text)", margin: "0 0 4px", letterSpacing: "-0.01em" }}>
              Регистрация
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              style={{ textAlign: "center", fontSize: "0.72rem", fontWeight: 600, color: "rgba(37,99,235,0.5)", letterSpacing: "0.12em", marginBottom: "1.5rem" }}>
              СИСТЕМА БРОНИРОВАНИЯ ПЕРЕГОВОРНЫХ
            </motion.p>

            <div style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(37,99,235,0.25),rgba(99,102,241,0.18),transparent)", marginBottom: "1.5rem" }} />

            {/* Form */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  style={{ padding: "0.6rem 0.9rem", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "var(--danger)", fontSize: "0.82rem", fontWeight: 600 }}>
                  {error}
                </motion.div>
              )}
              <input value={firstName} onChange={e => setFirst(e.target.value)} placeholder="Имя *" style={inputStyle}
                onFocus={e => { e.target.style.borderColor = "rgba(37,99,235,0.6)"; e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.10)"; }}
                onBlur={e => { e.target.style.borderColor = "rgba(37,99,235,0.2)"; e.target.style.boxShadow = "none"; }} />
              <input value={lastName} onChange={e => setLast(e.target.value)} placeholder="Фамилия *" style={inputStyle}
                onFocus={e => { e.target.style.borderColor = "rgba(37,99,235,0.6)"; e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.10)"; }}
                onBlur={e => { e.target.style.borderColor = "rgba(37,99,235,0.2)"; e.target.style.boxShadow = "none"; }} />
              <button onClick={handleRegister} disabled={loading}
                style={{ marginTop: 4, padding: "0.875rem", borderRadius: 14, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#2563eb,#6366f1)", color: "#fff", fontSize: "0.95rem", fontWeight: 700, boxShadow: "0 4px 16px rgba(37,99,235,0.3)", opacity: loading ? 0.6 : 1, transition: "opacity 0.15s" }}>
                {loading ? "Регистрация..." : "Зарегистрироваться"}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Root page ─────────────────────────────────────────────────────────────────
export default function TgAppPage() {
  const [phase, setPhase] = useState("loading"); // loading | register | app
  const [user, setUser]   = useState(null);

  const tryLogin = useCallback(async () => {
    // Try existing token first
    if (getTgToken()) {
      try {
        const me = await getMe();
        setUser(me);
        setPhase("app");
        return;
      } catch { clearTgToken(); }
    }
    // Try Telegram initData
    const data = initData();
    if (data) {
      try {
        const res = await tgLogin(data);
        setTgToken(res.access_token);
        const me = await getMe();
        setUser(me);
        setPhase("app");
        return;
      } catch(e) {
        if (e.message?.includes("404") || e.message === "User not registered") {
          setPhase("register");
          return;
        }
      }
    }
    // Dev fallback: no Telegram context
    setPhase("register");
  }, []);

  useEffect(() => {
    tgApp()?.ready?.();
    tgApp()?.expand?.();
    tryLogin();
  }, []);

  const handleRegistered = async () => {
    const me = await getMe();
    setUser(me);
    setPhase("app");
  };

  if (phase === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid rgba(124,58,237,0.2)", borderTopColor: "#7c3aed", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (phase === "register") {
    return <RegisterForm onRegistered={handleRegistered} />;
  }

  return <TgMain user={user} onLogout={() => { clearTgToken(); setPhase("loading"); tryLogin(); }} />;
}
