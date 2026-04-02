import { useState, useCallback } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "./hooks/useAuth";
import { useTheme } from "./contexts/ThemeContext";
import { DotMatrixLogo } from "./components/Common/DotMatrixLogo";
import { SplashScreen } from "./components/Common/SplashScreen";
import Calendar from "./components/Calendar";
import BookingModal from "./components/Dashboard/BookingModal";
import BookingsList from "./components/Dashboard/BookingsList";
import AdminPanel from "./components/Dashboard/AdminPanel";
import LoginPage from "./pages/LoginPage";
import SessionAuthPage from "./pages/SessionAuthPage";
import TabletPage from "./pages/TabletPage";
import TgAppPage from "./pages/TgAppPage";

function Dashboard() {
  const { user, loading, logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const [splashDone, setSplashDone] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStart, setModalStart] = useState(null);
  const [modalEnd, setModalEnd] = useState(null);
  const [modalRoomId, setModalRoomId] = useState(null);
  const [editBooking, setEditBooking] = useState(null);

  // Side panels
  const [showMeetings, setShowMeetings] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  // Room tint for header
  const [roomTint, setRoomTint] = useState("rgba(124,58,237,0.07)");

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleSlotClick = useCallback((start, end, roomId) => {
    setEditBooking(null);
    setModalStart(start);
    setModalEnd(end);
    setModalRoomId(roomId || null);
    setModalOpen(true);
  }, []);

  const handleCardClick = useCallback((booking) => {
    setEditBooking(booking);
    setModalStart(null);
    setModalEnd(null);
    setModalOpen(true);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: "rgba(37,99,235,0.3)", borderTopColor: "rgba(37,99,235,0.8)" }} />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!splashDone) {
    return <SplashScreen onFinish={() => setSplashDone(true)} />;
  }

  const isAdmin = user.role === "admin" || user.role === "superadmin";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="flex-shrink-0 px-4 py-2 flex items-center justify-between"
        style={{ background: `linear-gradient(${roomTint}, ${roomTint}), var(--header)`, backdropFilter: `blur(var(--glass-blur))`, borderBottom: "1px solid var(--border)", height: 52, transition: "background 0.5s" }}>
        <div className="flex items-center gap-3">
          <DotMatrixLogo />
        </div>

        <div className="flex items-center gap-2">
          {/* Meetings panel toggle */}
          <button onClick={() => { setShowMeetings(!showMeetings); setShowAdmin(false); }}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
            style={{ background: showMeetings ? "var(--primary-light)" : "var(--elevated)", border: "1px solid var(--border)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={showMeetings ? "var(--primary)" : "var(--text-muted)"} strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
          </button>

          {/* Admin panel toggle */}
          {isAdmin && (
            <button onClick={() => { setShowAdmin(!showAdmin); setShowMeetings(false); }}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: showAdmin ? "var(--primary-light)" : "var(--elevated)", border: "1px solid var(--border)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={showAdmin ? "var(--primary)" : "var(--text-muted)"} strokeWidth="2">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          )}

          {/* Theme toggle */}
          <button onClick={toggle}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
            style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}>
            {isDark ? "☀️" : "🌙"}
          </button>

          {/* User */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: "var(--elevated)", border: "1px solid var(--border)" }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg, #4f46e5, #2563eb)" }}>
              {user.first_name?.[0]?.toUpperCase()}
            </div>
            <span className="text-sm font-medium hidden sm:block" style={{ color: "var(--text)" }}>
              {user.first_name}
            </span>
          </div>

          <button onClick={logout}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: "var(--elevated)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            Выйти
          </button>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex min-h-0">
        <Calendar currentUser={user} onSlotClick={handleSlotClick} onCardClick={handleCardClick} onRoomChange={setRoomTint} />
      </div>

      {/* FAB */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => { setEditBooking(null); setModalStart(null); setModalEnd(null); setModalOpen(true); }}
        className="fixed bottom-6 right-6 z-20 w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg"
        style={{ background: "linear-gradient(135deg, #4f46e5, #2563eb)", boxShadow: "0 8px 24px rgba(79,70,229,0.4)" }}>
        +
      </motion.button>

      {/* Booking Modal */}
      <BookingModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialStart={modalStart}
        initialEnd={modalEnd}
        initialRoomId={modalRoomId}
        editBooking={editBooking}
        currentUser={user}
        onSuccess={msg => showToast(msg, "success")}
        onError={msg => showToast(msg, "error")}
      />

      {/* Side panels */}
      <BookingsList isOpen={showMeetings} onClose={() => setShowMeetings(false)} onCardClick={b => { setShowMeetings(false); handleCardClick(b); }} />
      <AdminPanel isOpen={showAdmin} onClose={() => setShowAdmin(false)} currentUser={user} />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-6 z-50 px-4 py-3 rounded-xl text-sm font-semibold"
            style={{
              background: toast.type === "error" ? "var(--danger)" : "var(--success)",
              color: "white",
              boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            }}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/session/:token" element={<SessionAuthPage />} />
      <Route path="/bookings" element={<Dashboard />} />
      <Route path="/tablet" element={<TabletPage />} />
      <Route path="/tg" element={<TgAppPage />} />
      <Route path="*" element={<Navigate to="/bookings" replace />} />
    </Routes>
  );
}
