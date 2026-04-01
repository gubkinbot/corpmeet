import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import LoginPage from "./pages/LoginPage";
import SessionAuthPage from "./pages/SessionAuthPage";

function BookingsPage() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div style={styles.center}>
        <p>Загрузка...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>CorpMeet</h1>
        <div style={styles.userInfo}>
          <span>{user.first_name} {user.last_name || ""}</span>
          <button onClick={logout} style={styles.logoutBtn}>Выйти</button>
        </div>
      </header>
      <main style={styles.main}>
        <p>Бронирование переговорных комнат</p>
        <p style={{ color: "#999", fontSize: "0.9rem" }}>
          Интерфейс бронирования — в разработке
        </p>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/session/:token" element={<SessionAuthPage />} />
      <Route path="/bookings" element={<BookingsPage />} />
      <Route path="*" element={<Navigate to="/bookings" replace />} />
    </Routes>
  );
}

const styles = {
  center: {
    fontFamily: "sans-serif",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
  },
  container: {
    fontFamily: "sans-serif",
    minHeight: "100vh",
    background: "#f5f5f5",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1rem 2rem",
    background: "white",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  title: {
    margin: 0,
    fontSize: "1.5rem",
  },
  userInfo: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  },
  logoutBtn: {
    background: "none",
    border: "1px solid #ccc",
    borderRadius: "0.25rem",
    padding: "0.4rem 0.8rem",
    cursor: "pointer",
    fontSize: "0.9rem",
  },
  main: {
    padding: "2rem",
  },
};
