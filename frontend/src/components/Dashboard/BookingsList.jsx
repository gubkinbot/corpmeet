import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useActiveBookings } from "../../hooks/useBookings";
import { exportBookings } from "../../lib/bookings";
import { getFeedToken } from "../../lib/users";

function fmt(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function getStatus(b) {
  const now = Date.now();
  const start = new Date(b.start_time).getTime();
  const end = new Date(b.end_time).getTime();
  if (now >= start && now < end) return { label: "Сейчас", color: "var(--success)" };
  const diff = (start - now) / 60000;
  if (diff <= 15 && diff > 0) return { label: `Через ${Math.ceil(diff)} мин`, color: "#f59e0b" };
  if (diff <= 1440 && diff > 0) return { label: "Скоро", color: "var(--text-muted)" };
  return { label: fmtDate(b.start_time), color: "var(--text-muted)" };
}

export default function BookingsList({ isOpen, onClose, onCardClick }) {
  const { data: bookings = [] } = useActiveBookings();

  const grouped = useMemo(() => {
    const groups = {};
    const today = new Date().toDateString();
    const tomorrow = new Date(Date.now() + 86400000).toDateString();
    for (const b of bookings) {
      const ds = new Date(b.start_time).toDateString();
      const label = ds === today ? "Сегодня" : ds === tomorrow ? "Завтра" : fmtDate(b.start_time);
      if (!groups[label]) groups[label] = [];
      groups[label].push(b);
    }
    return groups;
  }, [bookings]);

  const handleExport = async () => {
    const blob = await exportBookings();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "corpmeet.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyFeed = async () => {
    try {
      const { feed_url } = await getFeedToken();
      await navigator.clipboard.writeText(window.location.origin + "/api" + feed_url);
    } catch { /* ignore */ }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-30" onClick={onClose} />
          <motion.div
            initial={{ x: 320, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 320, opacity: 0 }}
            transition={{ type: "spring", damping: 24, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-40 w-80 flex flex-col"
            style={{ background: "var(--panel)", borderLeft: "1px solid var(--border)", boxShadow: "var(--panel-shadow)" }}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <h3 className="text-sm font-bold" style={{ color: "var(--text)" }}>Ближайшие встречи</h3>
              <button onClick={onClose} className="text-sm" style={{ color: "var(--text-muted)" }}>✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {Object.entries(grouped).length === 0 && (
                <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>Нет ближайших встреч</p>
              )}
              {Object.entries(grouped).map(([label, items]) => (
                <div key={label} className="mb-4">
                  <h4 className="text-xs font-bold mb-2 px-1" style={{ color: "var(--text-muted)", letterSpacing: "0.05em" }}>{label.toUpperCase()}</h4>
                  {items.map(b => {
                    const st = getStatus(b);
                    return (
                      <div key={b.id} onClick={() => onCardClick(b)}
                        className="rounded-xl p-3 mb-2 cursor-pointer transition-all hover:scale-[1.01]"
                        style={{ background: "var(--elevated)", border: "1px solid var(--border-light)" }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{b.title}</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: st.color, background: `${st.color}18` }}>{st.label}</span>
                        </div>
                        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {fmt(b.start_time)} – {fmt(b.end_time)}
                        </div>
                        {b.user && (
                          <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                            {b.user.first_name} {b.user.last_name || ""}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="p-3 flex gap-2" style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={handleExport} className="flex-1 py-2 rounded-xl text-xs font-semibold"
                style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                📥 .ics
              </button>
              <button onClick={handleCopyFeed} className="flex-1 py-2 rounded-xl text-xs font-semibold"
                style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                🔗 iCal-фид
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
