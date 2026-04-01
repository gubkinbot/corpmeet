import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { storage } from "../lib/storage";

export default function LoginPage() {
  const navigate = useNavigate();
  const [state, setState] = useState("loading"); // loading | qr | expired | error | tg_not_registered
  const [qrData, setQrData] = useState(null);
  const pollingRef = useRef(null);

  useEffect(() => {
    // Already authenticated?
    if (storage.getToken()) {
      navigate("/bookings", { replace: true });
      return;
    }

    // Check if inside Telegram Mini App
    const tg = window.Telegram?.WebApp;
    const initData = tg?.initData;

    if (initData) {
      // Auto-login via initData
      tg.ready();
      tg.expand();
      loginWithInitData(initData);
    } else {
      // Browser — show QR
      createQrSession();
    }

    return () => stopPolling();
  }, []);

  async function loginWithInitData(initData) {
    try {
      const res = await apiFetch("/auth/login", {
        method: "POST",
        body: { init_data: initData },
      });

      if (res.ok) {
        const data = await res.json();
        storage.setToken(data.access_token);
        navigate("/bookings", { replace: true });
      } else if (res.status === 404) {
        setState("tg_not_registered");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }

  async function createQrSession() {
    try {
      const res = await apiFetch("/auth/qr-session", { method: "POST" });
      if (!res.ok) {
        setState("error");
        return;
      }

      const data = await res.json();
      setQrData(data);
      setState("qr");
      startPolling(data.token);
    } catch {
      setState("error");
    }
  }

  function startPolling(token) {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const res = await apiFetch(`/auth/session/${token}`);

        if (res.status === 200) {
          const data = await res.json();
          storage.setToken(data.access_token);
          stopPolling();
          navigate("/bookings", { replace: true });
        } else if (res.status === 410) {
          stopPolling();
          setState("expired");
        }
        // 202 — still waiting, continue polling
      } catch {
        // Network error, keep trying
      }
    }, 2000);
  }

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  function handleRefresh() {
    setState("loading");
    createQrSession();
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>CorpMeet</h1>
      <p style={styles.subtitle}>Сервис бронирования переговорных</p>

      {state === "loading" && <p style={styles.status}>Загрузка...</p>}

      {state === "qr" && qrData && (
        <div style={styles.qrBlock}>
          <p style={styles.instruction}>
            Отсканируйте QR-код в Telegram для входа
          </p>
          <div style={styles.qrWrapper}>
            <QRCodeSVG value={qrData.bot_url} size={220} />
          </div>
          <div style={styles.dots}>
            <span style={styles.dot}>●</span>
            <span style={{ ...styles.dot, animationDelay: "0.3s" }}>●</span>
            <span style={{ ...styles.dot, animationDelay: "0.6s" }}>●</span>
          </div>
          <p style={styles.waiting}>Ожидание подтверждения...</p>
          <a
            href={qrData.bot_url}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.link}
          >
            Открыть бота в Telegram
          </a>
        </div>
      )}

      {state === "expired" && (
        <div style={styles.qrBlock}>
          <p style={styles.expiredText}>QR-код истёк</p>
          <button onClick={handleRefresh} style={styles.button}>
            Создать новый
          </button>
        </div>
      )}

      {state === "tg_not_registered" && (
        <div style={styles.qrBlock}>
          <p style={styles.expiredText}>
            Вы не зарегистрированы. Откройте бота в Telegram для регистрации.
          </p>
        </div>
      )}

      {state === "error" && (
        <div style={styles.qrBlock}>
          <p style={styles.expiredText}>Ошибка авторизации</p>
          <button onClick={handleRefresh} style={styles.button}>
            Попробовать снова
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    padding: "2rem",
    background: "#f5f5f5",
  },
  title: {
    fontSize: "2rem",
    margin: "0 0 0.5rem",
  },
  subtitle: {
    color: "#666",
    margin: "0 0 2rem",
  },
  status: {
    color: "#999",
  },
  qrBlock: {
    background: "white",
    borderRadius: "1rem",
    padding: "2rem",
    textAlign: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  instruction: {
    margin: "0 0 1.5rem",
    color: "#333",
  },
  qrWrapper: {
    display: "inline-block",
    padding: "1rem",
    background: "white",
    borderRadius: "0.5rem",
  },
  dots: {
    margin: "1rem 0 0.5rem",
    fontSize: "1.2rem",
    color: "#2196f3",
  },
  dot: {
    display: "inline-block",
    margin: "0 0.2rem",
    animation: "blink 1.2s infinite",
  },
  waiting: {
    color: "#999",
    fontSize: "0.9rem",
    margin: "0 0 1rem",
  },
  link: {
    color: "#2196f3",
    textDecoration: "none",
    fontSize: "0.9rem",
  },
  expiredText: {
    color: "#f44336",
    marginBottom: "1rem",
  },
  button: {
    background: "#2196f3",
    color: "white",
    border: "none",
    borderRadius: "0.5rem",
    padding: "0.75rem 1.5rem",
    fontSize: "1rem",
    cursor: "pointer",
  },
};
