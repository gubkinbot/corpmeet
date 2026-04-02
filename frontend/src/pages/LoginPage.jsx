import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { apiFetch } from "../lib/api";
import { storage } from "../lib/storage";

/* ── QR Auth ── */
function QrAuth() {
  const navigate = useNavigate();
  const [botUrl, setBotUrl] = useState(null);
  const [token, setToken] = useState(null);
  const [expired, setExpired] = useState(false);

  const createSession = useCallback(async () => {
    setExpired(false);
    try {
      const res = await apiFetch("/auth/qr-session", { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      setToken(data.token);
      setBotUrl(data.bot_url);
    } catch {
      setBotUrl(null);
    }
  }, []);

  useEffect(() => { createSession(); }, [createSession]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const poll = async () => {
      while (active) {
        await new Promise(r => setTimeout(r, 2000));
        if (!active) break;
        try {
          const res = await apiFetch(`/auth/session/${token}`);
          if (res.status === 200) {
            const data = await res.json();
            storage.setToken(data.access_token);
            navigate("/bookings", { replace: true });
            return;
          }
          if (res.status === 410) { setExpired(true); return; }
        } catch {
          /* network error, keep trying */
        }
      }
    };
    poll();
    return () => { active = false; };
  }, [token, navigate]);

  if (expired) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="flex flex-col items-center gap-3">
        <p className="text-sm font-semibold" style={{ color: "rgba(239,68,68,0.8)" }}>QR-код истёк</p>
        <button onClick={createSession}
          className="px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg, #2563eb, #6366f1)" }}>
          Создать новый
        </button>
      </motion.div>
    );
  }

  if (!botUrl) {
    return (
      <div className="flex items-center justify-center py-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 rounded-full border-2"
          style={{ borderColor: "rgba(37,99,235,0.3)", borderTopColor: "rgba(37,99,235,0.8)" }}
        />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}
      className="flex flex-col items-center gap-4">
      <div className="p-3 rounded-2xl" style={{ background: "white", boxShadow: "0 2px 16px rgba(37,99,235,0.12)" }}>
        <QRCodeSVG value={botUrl} size={180} level="M" bgColor="#ffffff" fgColor="#1e293b" style={{ display: "block" }} />
      </div>

      <p className="text-xs text-center" style={{ color: "rgba(37,99,235,0.55)", maxWidth: 240, lineHeight: 1.6 }}>
        Отсканируйте камерой телефона для авторизации через Telegram
      </p>

      <a href={botUrl} target="_blank" rel="noreferrer"
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
        style={{ background: "rgba(37,99,235,0.06)", border: "1.5px solid rgba(37,99,235,0.2)", color: "rgba(37,99,235,0.7)" }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(37,99,235,0.12)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(37,99,235,0.06)"; }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.99 1.27-5.62 3.72-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.88.03-.24.37-.49 1.02-.75 3.97-1.73 6.62-2.87 7.94-3.44 3.79-1.58 4.57-1.85 5.08-1.86.11 0 .37.03.54.17.14.12.18.28.2.47-.01.06.01.24 0 .38z"/></svg>
        Открыть бота в Telegram
      </a>

      <div className="flex items-center gap-2">
        {[0, 0.2, 0.4].map((d, i) => (
          <motion.div key={i} className="w-1.5 h-1.5 rounded-full"
            style={{ background: "rgba(37,99,235,0.65)" }}
            animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.4, 0.8] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: d }} />
        ))}
        <span className="text-xs ml-1 font-semibold" style={{ color: "rgba(37,99,235,0.4)", letterSpacing: "0.06em" }}>
          ОЖИДАНИЕ
        </span>
      </div>
    </motion.div>
  );
}

/* ── Dev Login ── */
function DevLoginButton() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/auth/dev-login", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        storage.setToken(data.access_token);
        navigate("/bookings", { replace: true });
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  return (
    <button onClick={handleClick} disabled={loading}
      className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
      style={{ border: "1.5px dashed rgba(37,99,235,0.3)", color: "rgba(37,99,235,0.5)", background: "rgba(37,99,235,0.04)", letterSpacing: "0.04em" }}>
      {loading ? "Входим..." : "DEV — войти без Telegram"}
    </button>
  );
}

/* ── Main Login Page ── */
export default function LoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (storage.getToken()) {
      navigate("/bookings", { replace: true });
      return;
    }

    const tg = window.Telegram?.WebApp;
    const initData = tg?.initData;
    if (initData) {
      tg.ready();
      tg.expand();
      apiFetch("/auth/login", { method: "POST", body: { init_data: initData } })
        .then(res => {
          if (res.ok) return res.json();
          if (res.status === 404) navigate("/register", { replace: true });
          throw new Error("Auth failed");
        })
        .then(data => {
          if (data) {
            storage.setToken(data.access_token);
            navigate("/bookings", { replace: true });
          }
        })
        .catch(() => {});
    }
  }, [navigate]);

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "var(--bg)" }}>
      <div className="relative flex flex-col items-center justify-center min-h-screen px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.88, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
          className="relative w-full max-w-[480px]"
        >
          {/* Glow */}
          <div className="absolute -inset-8 rounded-3xl pointer-events-none" style={{
            background: "radial-gradient(ellipse, rgba(37,99,235,0.16) 0%, transparent 70%)",
            filter: "blur(20px)",
          }} />

          {/* Card */}
          <div className="relative rounded-2xl overflow-hidden" style={{
            background: "var(--surface)",
            border: "1px solid rgba(37,99,235,0.2)",
            boxShadow: "var(--card-shadow), 0 0 0 1px rgba(99,102,241,0.07)",
            backdropFilter: `blur(var(--glass-blur))`,
          }}>
            {/* Top gradient line */}
            <div className="absolute top-0 inset-x-0 h-px" style={{
              background: "linear-gradient(90deg, transparent, rgba(37,99,235,0.7), rgba(99,102,241,0.5), transparent)",
            }} />

            {/* Corner decorations */}
            {["top-0 left-0 border-t border-l","top-0 right-0 border-t border-r","bottom-0 left-0 border-b border-l","bottom-0 right-0 border-b border-r"].map((cls, i) => (
              <div key={i} className={`absolute w-5 h-5 ${cls}`} style={{ borderColor: "rgba(37,99,235,0.35)" }} />
            ))}

            <div className="p-10">
              {/* Logo section */}
              <div className="flex flex-col items-center mb-7 gap-3">
                <div className="relative p-4 rounded-2xl" style={{
                  background: "linear-gradient(135deg, rgba(37,99,235,0.07), rgba(99,102,241,0.04))",
                  border: "1px solid rgba(37,99,235,0.12)",
                }}>
                  <motion.div className="absolute -inset-3 rounded-3xl pointer-events-none"
                    animate={{ opacity: [0.3, 0.75, 0.3] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                    style={{ background: "radial-gradient(ellipse, rgba(37,99,235,0.22) 0%, transparent 70%)", filter: "blur(8px)" }}
                  />
                  <img src="/logo.png" alt="UZINFOCOM" className="relative h-14 object-contain" />
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="h-px w-10" style={{ background: "linear-gradient(90deg, transparent, rgba(37,99,235,0.35))" }} />
                  <span style={{ color: "rgba(37,99,235,0.9)", fontSize: 16, letterSpacing: "0.18em", fontFamily: "Unbounded, sans-serif", fontWeight: 800 }}>CORPMEET</span>
                  <div className="h-px w-10" style={{ background: "linear-gradient(90deg, rgba(37,99,235,0.35), transparent)" }} />
                </div>
              </div>

              {/* Title */}
              <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                className="text-2xl font-bold text-center mb-2"
                style={{ color: "var(--text)", letterSpacing: "-0.01em" }}>
                Добро пожаловать!
              </motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
                className="text-center text-xs font-semibold mb-7"
                style={{ color: "rgba(37,99,235,0.5)", letterSpacing: "0.12em" }}>
                СИСТЕМА БРОНИРОВАНИЯ ПЕРЕГОВОРНЫХ
              </motion.p>

              <div className="mb-6 h-px" style={{
                background: "linear-gradient(90deg, transparent, rgba(37,99,235,0.25), rgba(99,102,241,0.18), transparent)",
              }} />

              {/* QR Auth */}
              <QrAuth />

              {/* Dev bypass */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
                className="mt-5">
                <DevLoginButton />
              </motion.div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}
          className="mt-5 flex items-center gap-3">
          <div className="h-px w-16" style={{ background: "linear-gradient(90deg, transparent, rgba(37,99,235,0.25))" }} />
          <span className="text-xs" style={{ color: "rgba(37,99,235,0.3)", letterSpacing: "0.06em" }}>
            Отсканируйте QR или откройте ссылку
          </span>
          <div className="h-px w-16" style={{ background: "linear-gradient(90deg, rgba(37,99,235,0.25), transparent)" }} />
        </motion.div>
      </div>
    </div>
  );
}
