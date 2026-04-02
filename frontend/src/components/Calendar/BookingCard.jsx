import { useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "../../contexts/ThemeContext";
import { useCalendarDrag } from "../../contexts/CalendarDragContext";

const LIGHT_PALETTES = [
  { bg: "#ede9fe", border: "#7c3aed", text: "#3b0764", accent: "#6d28d9", tint: "rgba(109,40,217,0.08)" },
  { bg: "#dbeafe", border: "#2563eb", text: "#1e3a8a", accent: "#1d4ed8", tint: "rgba(29,78,216,0.07)" },
  { bg: "#d1fae5", border: "#059669", text: "#064e3b", accent: "#047857", tint: "rgba(4,120,87,0.07)" },
  { bg: "#fef3c7", border: "#d97706", text: "#78350f", accent: "#b45309", tint: "rgba(180,83,9,0.07)" },
  { bg: "#fee2e2", border: "#dc2626", text: "#7f1d1d", accent: "#b91c1c", tint: "rgba(185,28,28,0.07)" },
  { bg: "#fce7f3", border: "#be185d", text: "#500724", accent: "#9d174d", tint: "rgba(157,23,77,0.07)" },
  { bg: "#e0e7ff", border: "#4338ca", text: "#1e1b4b", accent: "#3730a3", tint: "rgba(55,48,163,0.07)" },
  { bg: "#ffedd5", border: "#ea580c", text: "#7c2d12", accent: "#c2410c", tint: "rgba(194,65,12,0.07)" },
];

const DARK_PALETTES = [
  { bg: "rgba(139,92,246,0.16)", border: "#a78bfa", text: "#ede9fe", accent: "#c4b5fd", tint: "rgba(167,139,250,0.08)" },
  { bg: "rgba(59,130,246,0.14)",  border: "#60a5fa", text: "#dbeafe", accent: "#93c5fd", tint: "rgba(96,165,250,0.07)" },
  { bg: "rgba(16,185,129,0.14)",  border: "#34d399", text: "#d1fae5", accent: "#6ee7b7", tint: "rgba(52,211,153,0.07)" },
  { bg: "rgba(245,158,11,0.14)",  border: "#fbbf24", text: "#fef3c7", accent: "#fcd34d", tint: "rgba(251,191,36,0.07)" },
  { bg: "rgba(239,68,68,0.14)",   border: "#f87171", text: "#fee2e2", accent: "#fca5a5", tint: "rgba(248,113,113,0.07)" },
  { bg: "rgba(236,72,153,0.14)",  border: "#f472b6", text: "#fce7f3", accent: "#f9a8d4", tint: "rgba(244,114,182,0.07)" },
  { bg: "rgba(99,102,241,0.14)",  border: "#818cf8", text: "#e0e7ff", accent: "#a5b4fc", tint: "rgba(129,140,248,0.07)" },
  { bg: "rgba(251,146,60,0.14)",  border: "#fb923c", text: "#ffedd5", accent: "#fdba74", tint: "rgba(251,146,60,0.07)" },
];

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function fmt(iso) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export default function BookingCard({ booking, topPercent, heightPercent, onClick, currentUser }) {
  const { isDark } = useTheme();
  const { setDrag } = useCalendarDrag();
  const [isDragging, setIsDragging] = useState(false);
  const palettes = isDark ? DARK_PALETTES : LIGHT_PALETTES;
  const p = palettes[hashCode(String(booking.user_id)) % palettes.length];
  const isShort = heightPercent < 6;

  const canDrag = currentUser && (
    currentUser.id === booking.user_id ||
    currentUser.role === "admin" ||
    currentUser.role === "superadmin"
  );

  const handleDragStart = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetFraction = (e.clientY - rect.top) / rect.height;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", booking.id);
    setDrag({ booking, offsetFraction });
    requestAnimationFrame(() => setIsDragging(true));
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDrag(null);
  };

  const shadow = isDark
    ? `0 0 0 1px ${p.border}50, 0 4px 20px ${p.accent}30, inset 0 1px 0 rgba(255,255,255,0.07)`
    : `0 1px 0 ${p.border}40, 0 2px 8px ${p.border}30`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.18, type: "spring", stiffness: 340, damping: 22 }}
      whileHover={{ scale: 1.02, zIndex: 10 }}
      onClick={e => { e.stopPropagation(); onClick(); }}
      draggable={canDrag}
      onDragStart={canDrag ? handleDragStart : undefined}
      onDragEnd={canDrag ? handleDragEnd : undefined}
      className="absolute px-2 py-1 cursor-pointer overflow-hidden"
      style={{
        opacity: isDragging ? 0.4 : 1,
        top: `${topPercent}%`,
        height: `${heightPercent}%`,
        left: 4, right: 4,
        minHeight: 20,
        background: p.bg,
        borderTop: `1px solid ${p.border}28`,
        borderRight: `1px solid ${p.border}28`,
        borderBottom: `1px solid ${p.border}28`,
        borderLeft: `3px solid ${p.border}`,
        borderRadius: 10,
        boxShadow: shadow,
        backdropFilter: isDark ? "blur(8px)" : "none",
        zIndex: 2,
      }}
    >
      {/* Background tint */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: p.tint }} />

      <div className="h-full flex flex-col gap-0.5 relative z-10">
        {isShort ? (
          <p className="text-xs font-bold truncate leading-tight" style={{ color: p.text }}>
            {booking.title} · {fmt(booking.start_time)}
          </p>
        ) : (
          <>
            <div className="flex items-center gap-1">
              <p className="text-xs font-bold truncate flex-1" style={{ color: p.text }}>{booking.title}</p>
              <div className="flex items-center gap-0.5 shrink-0">
                {booking.recurrence && booking.recurrence !== "none" && (
                  <span className="text-xs px-1 rounded" style={{ background: `${p.border}20`, color: p.accent }}>🔄</span>
                )}
                {booking.guests?.length > 0 && (
                  <span className="text-xs px-1 rounded" style={{ background: `${p.border}20`, color: p.accent }}>
                    👥{booking.guests.length}
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs font-semibold" style={{ color: p.accent }}>
              {fmt(booking.start_time)}–{fmt(booking.end_time)}
            </p>
            {booking.user && (
              <p className="text-xs truncate" style={{ color: `${p.text}99` }}>
                {booking.user.first_name} {booking.user.last_name || ""}
              </p>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
