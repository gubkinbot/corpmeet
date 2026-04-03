import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCalendarDrag } from "../../contexts/CalendarDragContext";
import { useTheme } from "../../contexts/ThemeContext";
import BookingCard from "./BookingCard";

export const HOUR_HEIGHT = 64;
export const DAY_START = 7;
export const DAY_END = 22;
export const TOTAL_HOURS = DAY_END - DAY_START;
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;

const WEEKDAYS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

function toPercent(date) {
  const d = new Date(date);
  const hours = d.getHours() + d.getMinutes() / 60;
  return ((hours - DAY_START) / TOTAL_HOURS) * 100;
}

function snapTo30(date, y, totalH) {
  const frac = y / totalH;
  const hours = DAY_START + frac * TOTAL_HOURS;
  const snapped = Math.round(hours * 2) / 2;
  const h = Math.floor(snapped);
  const m = (snapped - h) * 60;
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

function pad(n) { return String(n).padStart(2, "0"); }

export default function DayColumn({ date, bookings, onSlotClick, onCardClick, onBookingDrop, isToday, currentUser }) {
  const { isDark } = useTheme();
  const { drag, setDrag } = useCalendarDrag();
  const gridRef = useRef(null);

  const [hoverY, setHoverY] = useState(null);
  const [ghost, setGhost] = useState(null);

  const dayNum = date.getDate();
  const weekday = WEEKDAYS[(date.getDay() + 6) % 7];
  const isPast = new Date(date).setHours(23, 59) < Date.now();
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  const nowPercent = useMemo(() => {
    if (!isToday) return null;
    const now = new Date();
    const hours = now.getHours() + now.getMinutes() / 60;
    if (hours < DAY_START || hours > DAY_END) return null;
    return ((hours - DAY_START) / TOTAL_HOURS) * 100;
  }, [isToday]);

  const gridBg = isToday
    ? "var(--day-grid-today)"
    : isWeekend
    ? "var(--day-grid-weekend)"
    : isPast
    ? "var(--day-grid-past)"
    : "var(--day-grid)";
  const headerBg = isToday ? "var(--day-header-today)" : "var(--day-header)";

  // ── Drag helpers ──

  function calcDrop(clientY) {
    if (!drag || !gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    const fraction = (clientY - rect.top) / rect.height;
    const durationMs = new Date(drag.booking.end_time) - new Date(drag.booking.start_time);
    const durationHours = durationMs / 3_600_000;
    const startFraction = fraction - (drag.offsetFraction * durationHours / TOTAL_HOURS);
    const totalMinutes = TOTAL_HOURS * 60;
    const rawMinute = DAY_START * 60 + startFraction * totalMinutes;
    const snapped = Math.round(rawMinute / 30) * 30;
    const maxStart = DAY_END * 60 - Math.round(durationMs / 60_000);
    const startMinute = Math.max(DAY_START * 60, Math.min(maxStart, snapped));
    const topPct = ((startMinute - DAY_START * 60) / totalMinutes) * 100;
    const heightPct = (durationHours / TOTAL_HOURS) * 100;
    return { topPct, heightPct, startMinute };
  }

  const handleDragOver = (e) => {
    if (isPast || !drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setHoverY(null);
    const calc = calcDrop(e.clientY);
    if (!calc) return;
    const h = Math.floor(calc.startMinute / 60), m = calc.startMinute % 60;
    const durationMs = new Date(drag.booking.end_time) - new Date(drag.booking.start_time);
    const endMinute = calc.startMinute + Math.round(durationMs / 60_000);
    const eh = Math.floor(endMinute / 60), em = endMinute % 60;
    const label = `${pad(h)}:${pad(m)} – ${pad(eh)}:${pad(em)}`;
    setGhost({ topPct: calc.topPct, heightPct: calc.heightPct, label });
  };

  const handleDragLeave = (e) => {
    if (!gridRef.current?.contains(e.relatedTarget)) setGhost(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setGhost(null);
    if (!drag || isPast) return;
    const calc = calcDrop(e.clientY);
    if (!calc) return;
    const newStart = new Date(date);
    newStart.setHours(Math.floor(calc.startMinute / 60), calc.startMinute % 60, 0, 0);
    onBookingDrop?.(drag.booking, newStart);
    setDrag(null);
  };

  // ── Click/hover ──

  const handleClick = (e) => {
    if (isPast || ghost) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const start = snapTo30(date, y, TOTAL_HEIGHT);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    onSlotClick(start, end);
  };

  const handleMouseMove = (e) => {
    if (isPast || drag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverY(e.clientY - rect.top);
  };

  const hoverSlot = useMemo(() => {
    if (hoverY === null || isPast) return null;
    const totalMinutes = TOTAL_HOURS * 60;
    const rawMinute = DAY_START * 60 + Math.round((hoverY / TOTAL_HEIGHT) * totalMinutes / 30) * 30;
    const snappedFrac = (rawMinute - DAY_START * 60) / totalMinutes;
    const endMinute = rawMinute + 60;
    const label = `${pad(Math.floor(rawMinute / 60))}:${pad(rawMinute % 60)} – ${pad(Math.floor(endMinute / 60))}:${pad(endMinute % 60)}`;
    return { startPct: snappedFrac * 100, heightPct: (60 / totalMinutes) * 100, label };
  }, [hoverY, isPast]);

  return (
    <div className="flex flex-col flex-1 min-w-0"
      style={{
        borderRight: "1px solid var(--border-light)",
        borderLeft: isToday ? "2px solid var(--primary)" : undefined,
      }}>
      {/* Header */}
      <div className="sticky top-0 z-10 flex flex-col items-center py-2"
        style={{ background: headerBg, backdropFilter: "blur(8px)", borderBottom: "1px solid var(--border-light)", height: 56 }}>
        <span className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: isToday ? "var(--primary)" : "var(--text-muted)", letterSpacing: "0.1em" }}>
          {weekday}
        </span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold mt-0.5"
          style={isToday ? {
            background: "linear-gradient(135deg,#7c3aed,#a855f7)",
            color: "white",
            boxShadow: isDark ? "0 0 14px rgba(139,92,246,0.55)" : "0 2px 10px rgba(109,40,217,0.35)",
          } : {
            color: isPast ? "var(--text-muted)" : "var(--text-sec)",
          }}>
          {dayNum}
        </div>
      </div>

      {/* Time grid */}
      <div
        ref={gridRef}
        className="relative"
        style={{ height: TOTAL_HEIGHT, background: gridBg, cursor: isPast ? "default" : "crosshair" }}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverY(null)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Hour lines */}
        {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
          <div key={`h${i}`} className="absolute left-0 right-0"
            style={{ top: i * HOUR_HEIGHT, height: 1, background: "var(--hour-line)" }} />
        ))}
        {/* Half-hour dashes */}
        {Array.from({ length: TOTAL_HOURS }, (_, i) => (
          <div key={`hh${i}`} className="absolute left-0 right-0"
            style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2, height: 1, background: "var(--hour-dash)",
              backgroundImage: "repeating-linear-gradient(90deg,var(--hour-dash) 0,var(--hour-dash) 4px,transparent 4px,transparent 8px)" }} />
        ))}

        {/* Hover preview */}
        {hoverSlot && !ghost && (
          <div className="absolute left-0 right-0 pointer-events-none z-10"
            style={{
              top: `${hoverSlot.startPct}%`,
              height: `${hoverSlot.heightPct}%`,
              background: isDark ? "rgba(124,58,237,0.12)" : "rgba(124,58,237,0.07)",
              borderLeft: "2px solid var(--primary)",
              borderRadius: "0 4px 4px 0",
            }}>
            <span className="absolute top-0.5 left-1.5 text-xs font-semibold"
              style={{ color: "var(--primary)", opacity: 0.85 }}>
              {hoverSlot.label}
            </span>
          </div>
        )}

        {/* Drag ghost preview */}
        {ghost && drag && (
          <div className="absolute left-0 right-0 pointer-events-none z-30"
            style={{
              top: `${ghost.topPct}%`,
              height: `${ghost.heightPct}%`,
              background: isDark ? "rgba(124,58,237,0.25)" : "rgba(124,58,237,0.12)",
              border: "2px dashed var(--primary)",
              borderRadius: 8,
              backdropFilter: "blur(2px)",
            }}>
            <span className="absolute top-1 left-2 text-xs font-bold" style={{ color: "var(--primary)" }}>
              {drag.booking.title}
            </span>
            <span className="absolute bottom-1 left-2 text-xs font-semibold" style={{ color: "var(--primary)", opacity: 0.8 }}>
              {ghost.label}
            </span>
          </div>
        )}

        {/* Current time indicator */}
        {nowPercent !== null && (
          <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${nowPercent}%` }}>
            <div className="relative flex items-center">
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2.5 h-2.5 rounded-full shrink-0 -ml-1"
                style={{ background: "#ef4444", boxShadow: "0 0 8px #ef4444" }}
              />
              <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg,#ef4444,transparent)", opacity: 0.7 }} />
            </div>
          </div>
        )}

        {/* Booking cards */}
        <AnimatePresence>
          {bookings.map(b => {
            const top = toPercent(b.start_time);
            const height = toPercent(b.end_time) - top;
            if (height <= 0) return null;
            return (
              <BookingCard
                key={b.id}
                booking={b}
                topPercent={top}
                heightPercent={height}
                currentUser={currentUser}
                onClick={() => onCardClick(b)}
              />
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
