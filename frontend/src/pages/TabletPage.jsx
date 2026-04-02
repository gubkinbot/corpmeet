import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../contexts/ThemeContext";
import { DotMatrixLogo } from "../components/Common/DotMatrixLogo";

const POLL_MS = 30_000;

function fmt(iso) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function timeLeftStr(endIso) {
  const ms = new Date(endIso) - new Date();
  if (ms <= 0) return "0м";
  const mins = Math.floor(ms / 60000);
  return mins >= 60 ? `${Math.floor(mins / 60)}ч ${mins % 60}м` : `${mins}м`;
}

function timeUsedPct(startIso, endIso) {
  const total = new Date(endIso) - new Date(startIso);
  const used = new Date() - new Date(startIso);
  return Math.min(100, Math.max(0, (used / total) * 100));
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ textAlign: "right", lineHeight: 1 }}>
      <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "var(--text)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
        {now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>
      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 3, textTransform: "capitalize" }}>
        {now.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
      </div>
    </div>
  );
}

function RoomCard({ room, index }) {
  const { isDark } = useTheme();
  const busy = !!room.current_booking;
  const pct = busy ? timeUsedPct(room.current_booking.start_time, room.current_booking.end_time) : 0;

  const successColor = isDark ? "#34d399" : "#059669";
  const dangerColor  = isDark ? "#f87171" : "#dc2626";
  const accentColor  = busy ? dangerColor : successColor;

  const cardBg = isDark
    ? busy ? "rgba(220,38,38,0.10)" : "rgba(5,150,105,0.10)"
    : busy ? "rgba(220,38,38,0.05)" : "rgba(5,150,105,0.05)";

  const cardBorder = isDark
    ? busy ? "rgba(220,38,38,0.30)" : "rgba(5,150,105,0.30)"
    : busy ? "rgba(220,38,38,0.20)" : "rgba(5,150,105,0.20)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, type: "spring", stiffness: 300, damping: 24 }}
      style={{
        borderRadius: 20,
        overflow: "hidden",
        border: `1.5px solid ${cardBorder}`,
        background: "var(--surface)",
        boxShadow: isDark
          ? `0 4px 32px ${busy ? "rgba(220,38,38,0.12)" : "rgba(5,150,105,0.10)"}, 0 1px 4px rgba(0,0,0,0.3)`
          : `0 4px 24px ${busy ? "rgba(220,38,38,0.08)" : "rgba(5,150,105,0.07)"}, 0 1px 4px rgba(0,0,0,0.05)`,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}>

      {/* Top accent bar */}
      <div style={{ height: 4, background: busy
        ? "linear-gradient(90deg,#dc2626,#f87171)"
        : "linear-gradient(90deg,#059669,#34d399)"
      }} />

      <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem", flex: 1, background: cardBg }}>

        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--text)", lineHeight: 1.2, margin: 0 }}>
              {room.name}
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 4, margin: 0 }}>
              Этаж {room.floor} · {room.capacity} мест
            </p>
          </div>

          {/* Status pill */}
          <div style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "0.35rem 0.9rem", borderRadius: 999,
            background: busy ? "rgba(220,38,38,0.12)" : "rgba(5,150,105,0.12)",
            border: `1px solid ${cardBorder}`,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: accentColor,
              boxShadow: `0 0 0 3px ${busy ? "rgba(220,38,38,0.25)" : "rgba(5,150,105,0.25)"}`,
              animation: busy ? "none" : "tabletPulse 2s infinite",
            }} />
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: accentColor, letterSpacing: "0.05em" }}>
              {busy ? "ЗАНЯТА" : "СВОБОДНА"}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "var(--border-light)" }} />

        {/* Main content */}
        {busy ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {/* Meeting title */}
            <div>
              <p style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text)", margin: 0, lineHeight: 1.3 }}>
                {room.current_booking.title}
              </p>
              <p style={{ fontSize: "0.95rem", color: "var(--text-sec)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                {fmt(room.current_booking.start_time)} — {fmt(room.current_booking.end_time)}
              </p>
              {room.current_booking.organizer && (
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 2 }}>
                  {room.current_booking.organizer}
                </p>
              )}
            </div>

            {/* Progress bar */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>
                  Прогресс
                </span>
                <span style={{ fontSize: "0.72rem", color: dangerColor, fontWeight: 700 }}>
                  Осталось {timeLeftStr(room.current_booking.end_time)}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  style={{
                    height: "100%", borderRadius: 99,
                    background: "linear-gradient(90deg,#dc2626,#f87171)",
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: 6 }}>✓</div>
              <p style={{ fontSize: "0.95rem", color: successColor, fontWeight: 600, margin: 0 }}>
                Комната свободна
              </p>
            </div>
          </div>
        )}

        {/* Next booking footer */}
        <div style={{
          padding: "0.65rem 0.9rem", borderRadius: 12,
          background: "var(--elevated)", border: "1px solid var(--border)",
        }}>
          {room.next_booking ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>
                Далее
              </span>
              <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                {fmt(room.next_booking.start_time)}
              </span>
              <span style={{ fontSize: "0.8rem", color: "var(--text-sec)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {room.next_booking.title}
              </span>
            </div>
          ) : (
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", textAlign: "center", margin: 0 }}>
              Больше встреч сегодня нет
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function TabletPage() {
  const { isDark, toggle } = useTheme();
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchStatus = () => {
    fetch("/api/rooms/status")
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => { setRooms(data); setLastUpdate(new Date()); setError(null); })
      .catch(() => setError("Нет соединения с сервером"));
  };

  useEffect(() => {
    fetchStatus();
    const t = setInterval(fetchStatus, POLL_MS);
    return () => clearInterval(t);
  }, []);

  const cols = rooms.length <= 1 ? 1 : rooms.length <= 4 ? 2 : 3;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>
      {/* Header */}
      <header style={{
        flexShrink: 0,
        padding: "0 1.5rem",
        height: 56,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "var(--header)",
        borderBottom: "1px solid var(--border)",
        boxShadow: isDark ? "0 1px 0 rgba(255,255,255,0.04)" : "0 1px 0 rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <DotMatrixLogo />
          <div style={{
            fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)",
            padding: "3px 10px", borderRadius: 6,
            background: "var(--elevated)", border: "1px solid var(--border)",
            letterSpacing: "0.04em", textTransform: "uppercase",
          }}>
            Переговорные
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          {lastUpdate && (
            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
              Обновлено {lastUpdate.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <button onClick={toggle} style={{
            width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)",
            background: "var(--elevated)", cursor: "pointer", fontSize: "0.9rem",
          }}>
            {isDark ? "☀️" : "🌙"}
          </button>
          <Clock />
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, overflow: "auto", padding: "1.25rem 1.5rem" }}>
        <AnimatePresence mode="wait">
          {error ? (
            <motion.div key="error"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: "1.1rem", color: "var(--danger)", fontWeight: 600 }}>⚠ {error}</p>
              <button onClick={fetchStatus} style={{
                padding: "0.6rem 1.5rem", borderRadius: 12, cursor: "pointer",
                background: "linear-gradient(135deg,#7c3aed,#a855f7)",
                color: "white", border: "none", fontWeight: 700, fontSize: "0.875rem",
              }}>
                Повторить
              </button>
            </motion.div>
          ) : rooms.length === 0 ? (
            <motion.div key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <p style={{ color: "var(--text-muted)" }}>Загрузка...</p>
            </motion.div>
          ) : (
            <div key="grid" style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: "1.25rem",
              height: "100%",
              alignContent: "start",
            }}>
              {rooms.map((room, i) => <RoomCard key={room.id} room={room} index={i} />)}
            </div>
          )}
        </AnimatePresence>
      </main>

      <style>{`
        @keyframes tabletPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}
