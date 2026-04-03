import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCreateBooking, useUpdateBooking, useDeleteBooking } from "../../hooks/useBookings";
import { useUsers, useRooms } from "../../hooks/useUsers";
import { useTheme } from "../../contexts/ThemeContext";
import DateTimePicker from "../Common/DateTimePicker";

function fmtLocal(d) {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  const pad = n => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

function fmtDisplay(iso) {
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const DURATIONS = [
  { label: "30м", mins: 30 },
  { label: "1ч", mins: 60 },
  { label: "1.5ч", mins: 90 },
  { label: "2ч", mins: 120 },
];

const RECURRENCE_OPTIONS = [
  { value: "none", label: "Без повторений" },
  { value: "daily", label: "Ежедневно" },
  { value: "weekly", label: "Еженедельно" },
  { value: "custom", label: "Своё расписание" },
];

const WEEKDAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/* ── Guest autocomplete ── */
function GuestInput({ guests, setGuests, canEdit }) {
  const { isDark } = useTheme();
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const { data: allUsers = [] } = useUsers(input.length >= 1 ? input : "");

  const suggestions = allUsers
    .filter(u => !guests.includes(u.username || u.first_name))
    .slice(0, 6);

  const addGuest = (name) => {
    const u = name.trim().replace(/^@/, "");
    if (u && !guests.includes(u)) setGuests(gs => [...gs, u]);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const commitInput = () => {
    const u = input.trim().replace(/^@/, "");
    if (u && !guests.includes(u)) setGuests(gs => [...gs, u]);
    setInput("");
  };

  useEffect(() => {
    const h = (e) => {
      if (!wrapRef.current?.contains(e.target)) setFocused(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const showDrop = focused && suggestions.length > 0 && input.length >= 1;

  if (!canEdit) {
    return (
      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-sec)" }}>Гости</label>
        <div className="flex flex-wrap gap-1.5 px-3 py-2 rounded-xl min-h-[36px]"
          style={{ background: "var(--input-bg)", border: "1.5px solid var(--input-border)" }}>
          {guests.length === 0
            ? <span className="text-xs" style={{ color: "var(--text-muted)" }}>Нет гостей</span>
            : guests.map(g => (
              <span key={g} className="px-2 py-0.5 rounded-lg text-xs font-semibold"
                style={{ background: "var(--primary-light)", border: "1px solid var(--primary-border)", color: "var(--primary)" }}>
                @{g}
              </span>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-sec)" }}>Гости</label>
      <div ref={wrapRef} className="relative">
        <div
          className="rounded-xl px-3 py-2 flex flex-wrap gap-1.5 min-h-[40px] cursor-text transition-all"
          style={{
            background: "var(--input-bg)",
            border: focused ? "1.5px solid var(--primary)" : "1.5px solid var(--input-border)",
            boxShadow: focused ? "0 0 0 3px rgba(124,58,237,0.12)" : "none",
          }}
          onClick={() => inputRef.current?.focus()}
        >
          {guests.map(g => (
            <span key={g} className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold"
              style={{ background: "var(--primary-light)", border: "1px solid var(--primary-border)", color: "var(--primary)" }}>
              @{g}
              <button type="button" onClick={() => setGuests(gs => gs.filter(x => x !== g))}
                className="opacity-60 hover:opacity-100 leading-none" style={{ fontSize: 14 }}>×</button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value.replace(/\s/g, ""))}
            onFocus={() => setFocused(true)}
            onKeyDown={e => {
              if ((e.key === "Enter" || e.key === ",") && input.trim()) { e.preventDefault(); commitInput(); }
              else if (e.key === "Backspace" && !input && guests.length > 0) setGuests(gs => gs.slice(0, -1));
            }}
            onBlur={() => setTimeout(() => { if (input.trim()) commitInput(); }, 150)}
            placeholder={guests.length === 0 ? "Имя или @username" : ""}
            className="flex-1 min-w-[100px] text-xs outline-none bg-transparent"
            style={{ color: "var(--text)" }}
          />
        </div>

        <AnimatePresence>
          {showDrop && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.1 }}
              className="absolute z-50 left-0 right-0 mt-1 rounded-xl overflow-hidden"
              style={{
                background: "var(--modal)",
                border: "1px solid var(--border)",
                boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.6)" : "0 4px 16px rgba(0,0,0,0.12)",
              }}>
              {suggestions.map(u => (
                <button key={u.id} type="button"
                  onMouseDown={e => { e.preventDefault(); addGuest(u.username || u.first_name); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs transition-all"
                  style={{ color: "var(--text)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--elevated)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                    {(u.first_name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold">{u.first_name} {u.last_name || ""}</div>
                    {u.username && <div style={{ color: "var(--text-muted)" }}>@{u.username}</div>}
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function BookingModal({ isOpen, onClose, initialStart, initialEnd, initialRoomId, editBooking, currentUser, onSuccess, onError }) {
  const { isDark } = useTheme();
  const createMut = useCreateBooking();
  const updateMut = useUpdateBooking();
  const deleteMut = useDeleteBooking();
  const { data: rooms = [] } = useRooms();

  const isEdit = !!editBooking;
  const canEdit = !isEdit || editBooking?.user_id === currentUser?.id || ["admin", "superadmin"].includes(currentUser?.role);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [roomId, setRoomId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [guests, setGuests] = useState([]);
  const [recurrence, setRecurrence] = useState("none");
  const [recurrenceUntil, setRecurrenceUntil] = useState("");
  const [recurrenceDays, setRecurrenceDays] = useState([]);
  const [showDelete, setShowDelete] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    if (isEdit && editBooking) {
      setTitle(editBooking.title || "");
      setDescription(editBooking.description || "");
      setRoomId(editBooking.room_id || "");
      setStartTime(fmtLocal(editBooking.start_time));
      setEndTime(fmtLocal(editBooking.end_time));
      setGuests(editBooking.guests || []);
      setRecurrence(editBooking.recurrence || "none");
    } else {
      setTitle("");
      setDescription("");
      if (initialRoomId) setRoomId(initialRoomId);
      setStartTime(initialStart ? fmtLocal(initialStart) : "");
      setEndTime(initialEnd ? fmtLocal(initialEnd) : "");
      setGuests([]);
      setRecurrence("none");
      setRecurrenceUntil("");
      setRecurrenceDays([]);
    }
    setShowDelete(false);
    setErrors({});
  }, [isOpen, editBooking, initialStart, initialEnd]);

  // Set default room when rooms load (or modal opens)
  useEffect(() => {
    if (!isOpen || isEdit) return;
    if (!roomId && rooms.length > 0) {
      setRoomId(rooms[0].id);
    }
  }, [isOpen, isEdit, rooms, roomId]);

  const applyDuration = (mins) => {
    if (!startTime) return;
    const e = new Date(new Date(startTime).getTime() + mins * 60000);
    setEndTime(fmtLocal(e));
  };

  const toggleDay = (d) => {
    setRecurrenceDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const validate = () => {
    const errs = {};
    if (!title.trim()) errs.title = "Название обязательно";
    if (!startTime || !endTime) errs.time = "Укажите время";
    else {
      const diff = (new Date(endTime) - new Date(startTime)) / 60000;
      if (diff < 15) errs.time = "Минимум 15 минут";
      if (diff > 480) errs.time = "Максимум 8 часов";
    }
    if (recurrence === "custom" && recurrenceDays.length === 0) errs.days = "Выберите хотя бы один день";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const effectiveRoomId = roomId || rooms[0]?.id;
    if (!isEdit && !effectiveRoomId) {
      setErrors(prev => ({ ...prev, submit: "Выберите переговорную" }));
      return;
    }
    try {
      if (isEdit) {
        await updateMut.mutateAsync({
          id: editBooking.id,
          payload: { title, description: description || "", start_time: new Date(startTime).toISOString(), end_time: new Date(endTime).toISOString(), guests },
        });
        onSuccess?.("✅ Встреча обновлена");
      } else {
        const payload = {
          room_id: effectiveRoomId, title, description: description || "",
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          guests, recurrence,
        };
        if (recurrence !== "none") {
          let until = recurrenceUntil;
          if (!until) {
            const d = new Date(startTime);
            d.setDate(d.getDate() + 7);
            until = d.toISOString().split("T")[0];
          }
          payload.recurrence_until = until;
          if (recurrence === "custom") payload.recurrence_days = recurrenceDays;
        }
        const created = await createMut.mutateAsync(payload);
        onSuccess?.(created.length > 1 ? `✅ Создано ${created.length} встреч` : "✅ Встреча забронирована");
      }
      onClose();
    } catch (e) {
      const msg = e.message || "Ошибка сохранения";
      onError?.(msg);
      setErrors(prev => ({ ...prev, submit: msg }));
    }
  };

  const handleDelete = async (series) => {
    try {
      await deleteMut.mutateAsync({ id: editBooking.id, deleteSeries: series });
      onSuccess?.(series ? "🗑 Серия встреч удалена" : "🗑 Бронирование удалено");
      onClose();
    } catch (e) {
      onError?.(e.message || "Ошибка удаления");
    }
  };

  const isLoading = createMut.isPending || updateMut.isPending || deleteMut.isPending;
  const errBg = isDark ? "rgba(239,68,68,0.1)" : "#fff1f2";
  const errBorder = isDark ? "rgba(239,68,68,0.3)" : "#fecdd3";
  const delBg = isDark ? "rgba(239,68,68,0.08)" : "#fff1f2";
  const delBorderColor = isDark ? "rgba(239,68,68,0.35)" : "#fecdd3";

  const inputStyle = (hasError) => ({
    background: "var(--input-bg)",
    border: `1.5px solid ${hasError ? "var(--danger)" : "var(--input-border)"}`,
    color: "var(--text)",
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
  });

  const inputFocusHandlers = {
    onFocus: e => {
      e.target.style.borderColor = "var(--primary)";
      e.target.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.12)";
    },
    onBlur: e => {
      e.target.style.borderColor = "var(--input-border)";
      e.target.style.boxShadow = "none";
    },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{ background: isDark ? "rgba(0,0,0,0.75)" : "rgba(15,23,42,0.4)", backdropFilter: "blur(6px)" }}
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 px-4 pointer-events-none">
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.9, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 24 }}
              transition={{ type: "spring", damping: 22, stiffness: 340 }}
              className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl pointer-events-auto"
              style={{
                background: "var(--modal)",
                border: "1px solid var(--border)",
                boxShadow: isDark
                  ? "0 32px 80px rgba(0,0,0,0.8), 0 0 60px rgba(139,92,246,0.1)"
                  : "0 20px 60px rgba(0,0,0,0.15)",
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Gradient stripe */}
              <div className="h-0.5 w-full flex-shrink-0 rounded-t-2xl"
                style={{ background: "linear-gradient(90deg,#7c3aed,#06b6d4,#a855f7)" }} />

              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3"
                style={{ borderBottom: "1px solid var(--border)" }}>
                <h2 className="text-base font-bold" style={{ color: "var(--text)" }}>
                  {isEdit ? "Редактирование встречи" : "Новое бронирование"}
                </h2>
                <button onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors"
                  style={{ background: "var(--elevated)", color: "var(--text-muted)" }}>
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-3">

                {showDelete ? (
                  /* Delete confirmation */
                  <div className="rounded-xl p-4 space-y-3"
                    style={{ background: delBg, border: `1px solid ${delBorderColor}` }}>
                    <p className="text-sm font-semibold" style={{ color: "var(--danger)" }}>
                      Удалить бронирование?
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-sec)" }}>
                      «{editBooking?.title}» · {editBooking?.start_time ? fmtDisplay(editBooking.start_time) : ""}
                    </p>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setShowDelete(false)}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold"
                        style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                        Отмена
                      </button>
                      <button onClick={() => handleDelete(false)} disabled={isLoading}
                        className="flex-1 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)", boxShadow: "0 4px 14px rgba(220,38,38,0.3)" }}>
                        Удалить
                      </button>
                    </div>
                    {editBooking?.recurrence_group_id && (
                      <button onClick={() => handleDelete(true)} disabled={isLoading}
                        className="w-full py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                        style={{ background: "rgba(239,68,68,0.12)", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.25)" }}>
                        Удалить всю серию
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Submit error */}
                    {errors.submit && (
                      <div className="rounded-xl px-3 py-2.5 text-xs font-medium"
                        style={{ background: errBg, border: `1px solid ${errBorder}`, color: isDark ? "#f87171" : "#dc2626" }}>
                        {errors.submit}
                      </div>
                    )}

                    {/* Title */}
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-sec)" }}>
                        Название <span style={{ color: "var(--danger)" }}>*</span>
                      </label>
                      <input
                        value={title} onChange={e => setTitle(e.target.value)}
                        placeholder="Планёрка, 1-on-1, Demo..."
                        className="w-full px-3 py-2.5 rounded-xl text-sm"
                        style={inputStyle(errors.title)}
                        disabled={!canEdit}
                        {...inputFocusHandlers}
                      />
                      {errors.title && <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{errors.title}</p>}
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-sec)" }}>
                        Повестка / заметки
                      </label>
                      <textarea
                        value={description} onChange={e => setDescription(e.target.value)}
                        rows={2} placeholder="Цель встречи, ссылки, материалы..."
                        className="w-full px-3 py-2.5 rounded-xl text-sm resize-none"
                        style={inputStyle(false)}
                        disabled={!canEdit}
                        {...inputFocusHandlers}
                      />
                    </div>

                    {/* Room display (read-only, selected in calendar toolbar) */}
                    {!isEdit && rooms.length > 0 && (
                      <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-sec)" }}>
                          Переговорная
                        </label>
                        <div className="px-3 py-2.5 rounded-xl text-sm"
                          style={{ background: "var(--input-bg)", border: "1.5px solid var(--input-border)", color: "var(--text)" }}>
                          {rooms.find(r => r.id === roomId)?.name || rooms[0]?.name || "—"}
                          {(() => { const r = rooms.find(x => x.id === roomId) || rooms[0]; return r ? ` (этаж ${r.floor}, ${r.capacity} мест)` : ""; })()}
                        </div>
                      </div>
                    )}

                    {/* Time */}
                    <div>
                      <div className="grid grid-cols-2 gap-3">
                        <DateTimePicker label="Начало" value={startTime} onChange={setStartTime} />
                        <DateTimePicker label="Конец" value={endTime} onChange={setEndTime} />
                      </div>
                      {errors.time && (
                        <p className="text-xs mt-1.5" style={{ color: "var(--danger)" }}>{errors.time}</p>
                      )}
                    </div>

                    {/* Duration presets */}
                    {canEdit && (
                      <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-sec)" }}>
                          Быстрая длительность
                        </label>
                        <div className="flex gap-2">
                          {DURATIONS.map(d => {
                            const curMins = startTime && endTime
                              ? Math.round((new Date(endTime) - new Date(startTime)) / 60000)
                              : 0;
                            const isActive = curMins === d.mins;
                            return (
                              <button key={d.mins} onClick={() => applyDuration(d.mins)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                                style={isActive
                                  ? { background: "var(--primary)", color: "#fff", border: "1px solid var(--primary)" }
                                  : { background: "var(--primary-light)", color: "var(--primary)", border: "1px solid var(--primary-border)" }}>
                                {d.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Guests */}
                    <GuestInput guests={guests} setGuests={setGuests} canEdit={canEdit} />

                    {/* Recurrence */}
                    {!isEdit && (
                      <div>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-sec)" }}>
                          Повторение
                        </label>
                        <div className="flex gap-1.5 flex-nowrap">
                          {RECURRENCE_OPTIONS.map(o => (
                            <button key={o.value} onClick={() => {
                              setRecurrence(o.value);
                              if (o.value === "custom" && recurrenceDays.length === 0 && startTime) {
                                const jsDay = new Date(startTime).getDay();
                                setRecurrenceDays([(jsDay + 6) % 7]);
                              }
                            }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                              style={recurrence === o.value
                                ? { background: "var(--primary)", color: "#fff" }
                                : { background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--text-sec)" }}>
                              {o.label}
                            </button>
                          ))}
                        </div>

                        {recurrence !== "none" && (
                          <div className="mt-2.5">
                            <DateTimePicker label="Повторять до"
                              value={recurrenceUntil
                                ? `${recurrenceUntil}T${startTime ? startTime.split("T")[1] : "09:00"}`
                                : (startTime ? startTime : "")}
                              onChange={v => setRecurrenceUntil(v.split("T")[0])} />
                          </div>
                        )}

                        {recurrence === "custom" && (
                          <div className="mt-2.5 flex gap-1">
                            {WEEKDAY_NAMES.map((name, i) => (
                              <button key={i} onClick={() => toggleDay(i)}
                                className="w-9 h-9 rounded-lg text-xs font-bold transition-all"
                                style={recurrenceDays.includes(i)
                                  ? { background: "var(--primary)", color: "#fff" }
                                  : { background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--text-sec)" }}>
                                {name}
                              </button>
                            ))}
                          </div>
                        )}
                        {errors.days && <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{errors.days}</p>}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      {isEdit && canEdit && (
                        <button onClick={() => setShowDelete(true)}
                          className="px-4 py-2.5 rounded-xl text-sm font-bold text-white"
                          style={{ background: "linear-gradient(135deg,#dc2626,#ef4444)", boxShadow: "0 4px 14px rgba(220,38,38,0.3)" }}>
                          Удалить
                        </button>
                      )}
                      <div className="flex-1" />
                      <button onClick={onClose}
                        className="px-4 py-2.5 rounded-xl text-sm font-medium"
                        style={{ background: "var(--elevated)", border: "1.5px solid var(--border)", color: "var(--text-sec)" }}>
                        Отмена
                      </button>
                      {canEdit && (
                        <button onClick={handleSubmit} disabled={isLoading}
                          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all"
                          style={{
                            background: "linear-gradient(135deg,#7c3aed,#a855f7)",
                            boxShadow: "0 4px 16px rgba(124,58,237,0.25)",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 24px rgba(124,58,237,0.4)"; }}
                          onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(124,58,237,0.25)"; }}>
                          {isLoading ? "..." : isEdit ? "Сохранить" : "Забронировать"}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
