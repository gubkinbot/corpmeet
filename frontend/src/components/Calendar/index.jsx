import { useState, useRef, useEffect, useMemo } from "react";
import DayColumn, { HOUR_HEIGHT, DAY_START, TOTAL_HOURS } from "./DayColumn";
import { useWeekBookings, useUpdateBooking } from "../../hooks/useBookings";
import { useRooms } from "../../hooks/useUsers";
import { CalendarDragProvider } from "../../contexts/CalendarDragContext";
import { useTheme } from "../../contexts/ThemeContext";

const HOURS = Array.from({ length: TOTAL_HOURS }, (_, i) => DAY_START + i);

const MONTHS_RU = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtDate(d) {
  return d.toISOString().split("T")[0];
}

function fmtLocalDate(d) {
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const ROOM_TINTS = [
  { light: "rgba(124,58,237,0.45)",  dark: "rgba(124,58,237,0.55)" },
  { light: "rgba(8,145,178,0.45)",   dark: "rgba(8,145,178,0.55)"  },
  { light: "rgba(5,150,105,0.45)",   dark: "rgba(5,150,105,0.55)"  },
  { light: "rgba(217,119,6,0.45)",   dark: "rgba(217,119,6,0.55)"  },
  { light: "rgba(220,38,38,0.45)",   dark: "rgba(220,38,38,0.55)"  },
  { light: "rgba(190,24,93,0.45)",   dark: "rgba(190,24,93,0.55)"  },
];

export function getRoomTint(rooms, roomId, isDark) {
  const idx = rooms.findIndex(r => r.id === roomId);
  const t = ROOM_TINTS[(idx < 0 ? 0 : idx) % ROOM_TINTS.length];
  return isDark ? t.dark : t.light;
}

export default function Calendar({ currentUser, onSlotClick, onCardClick, onRoomChange }) {
  const { isDark } = useTheme();
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [search, setSearch] = useState("");
  const isSuperadmin = currentUser?.role === "superadmin";
  const updateBooking = useUpdateBooking();
  const { data: rooms = [] } = useRooms();

  // superadmin can switch rooms; others use their assigned room
  const [selectedRoomId, setSelectedRoomId] = useState("");

  useEffect(() => {
    if (!selectedRoomId) {
      if (isSuperadmin && rooms.length > 0) {
        setSelectedRoomId(rooms[0].id);
      } else if (currentUser?.room_id) {
        setSelectedRoomId(currentUser.room_id);
      } else if (rooms.length > 0) {
        setSelectedRoomId(rooms[0].id);
      }
    }
  }, [rooms, currentUser, isSuperadmin, selectedRoomId]);

  useEffect(() => {
    if (selectedRoomId && rooms.length > 0) {
      onRoomChange?.(getRoomTint(rooms, selectedRoomId, isDark));
    }
  }, [selectedRoomId, rooms, isDark]);
  const gridRef = useRef(null);
  const timeRef = useRef(null);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(anchor, i)), [anchor]);
  const dateFrom = fmtDate(weekDays[0]);
  const dateTo = fmtDate(weekDays[6]);

  const { data: allBookings = [] } = useWeekBookings(dateFrom, dateTo);

  const today = new Date();
  const month = weekDays[3].getMonth();

  // Filter bookings by search
  const filtered = useMemo(() => {
    if (!search.trim()) return allBookings;
    const q = search.toLowerCase();
    return allBookings.filter(b =>
      b.title?.toLowerCase().includes(q) ||
      b.description?.toLowerCase().includes(q) ||
      b.user?.first_name?.toLowerCase().includes(q) ||
      b.user?.last_name?.toLowerCase().includes(q)
    );
  }, [allBookings, search]);

  // Group bookings by date
  const byDay = useMemo(() => {
    const map = {};
    for (const d of weekDays) map[fmtLocalDate(d)] = [];
    for (const b of filtered) {
      const bDate = fmtLocalDate(new Date(b.start_time));
      if (map[bDate]) map[bDate].push(b);
    }
    return map;
  }, [filtered, weekDays]);

  const handleBookingDrop = (booking, newStart) => {
    const durationMs = new Date(booking.end_time) - new Date(booking.start_time);
    const newEnd = new Date(newStart.getTime() + durationMs);
    updateBooking.mutate({ id: booking.id, payload: { start_time: newStart.toISOString(), end_time: newEnd.toISOString() } });
  };

  // Sync scroll between time axis and grid
  const handleScroll = () => {
    if (timeRef.current && gridRef.current) {
      timeRef.current.scrollTop = gridRef.current.scrollTop;
    }
  };

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (!gridRef.current) return;
    const now = new Date();
    const hours = now.getHours() + now.getMinutes() / 60;
    if (hours >= DAY_START && hours <= DAY_START + TOTAL_HOURS) {
      const scrollTo = (hours - DAY_START) * HOUR_HEIGHT - 200;
      gridRef.current.scrollTop = Math.max(0, scrollTo);
    }
  }, []);

  return (
    <CalendarDragProvider>
    <div className="flex flex-col flex-1 min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
        style={{ background: "var(--toolbar)", borderBottom: "1px solid var(--border)" }}>
        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button onClick={() => setAnchor(addDays(anchor, -7))}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
            style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            ←
          </button>
          <button onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setAnchor(d); }}
            className="px-3 h-8 rounded-lg text-xs font-semibold"
            style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--primary)" }}>
            Сегодня
          </button>
          <button onClick={() => setAnchor(addDays(anchor, 7))}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
            style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            →
          </button>
        </div>

        {/* Month label */}
        <h2 className="text-lg font-bold ml-2" style={{ color: "var(--text)", fontFamily: "Unbounded, sans-serif" }}>
          {MONTHS_RU[month]}
        </h2>

        {/* Room selector: show when user has access to multiple rooms */}
        {rooms.length > 1 && (
          <select value={selectedRoomId} onChange={e => setSelectedRoomId(e.target.value)}
            className="px-3 py-1.5 rounded-xl text-sm outline-none"
            style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text)" }}>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>{r.name} (эт. {r.floor})</option>
            ))}
          </select>
        )}
        {/* Static label when only one room visible */}
        {rooms.length === 1 && selectedRoomId && (
          <div className="px-3 py-1.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--text-sec)" }}>
            {rooms.find(r => r.id === selectedRoomId)?.name || ""}
          </div>
        )}

        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск..."
            className="pl-8 pr-3 py-1.5 rounded-xl text-sm w-48 outline-none"
            style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text)" }}
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
              style={{ color: "var(--text-muted)" }}>✕</button>
          )}
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Time axis */}
        <div ref={timeRef} className="flex-shrink-0 overflow-hidden" style={{ width: 52, background: "var(--time-axis)" }}>
          {/* Spacer for header */}
          <div style={{ height: 56 }} />
          <div style={{ position: "relative", height: TOTAL_HOURS * HOUR_HEIGHT }}>
            {HOURS.map(h => (
              <div key={h} className="absolute right-2 text-xs font-medium"
                style={{ top: (h - DAY_START) * HOUR_HEIGHT - 7, color: "var(--text-muted)" }}>
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
        </div>

        {/* Day columns */}
        <div ref={gridRef} className="flex flex-1 overflow-y-auto" onScroll={handleScroll}
          style={{ borderLeft: "1px solid var(--border-light)" }}>
          {weekDays.map(d => (
            <DayColumn
              key={fmtLocalDate(d)}
              date={d}
              bookings={byDay[fmtLocalDate(d)] || []}
              onSlotClick={(start, end) => onSlotClick(start, end, selectedRoomId)}
              onCardClick={onCardClick}
              onBookingDrop={handleBookingDrop}
              isToday={isSameDay(d, today)}
              currentUser={currentUser}
            />
          ))}
        </div>
      </div>
    </div>
    </CalendarDragProvider>
  );
}
