import { useEffect, useState } from "react";

const DESKTOP_PLATFORMS = ["tdesktop", "macos", "web"];
const API_BASE = "/api";

export default function App() {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) {
      setStatus("not-telegram");
      return;
    }

    tg.ready();
    tg.expand();

    const initData = tg.initData;
    const platform = tg.platform || "";
    const tgUser = tg.initDataUnsafe?.user;

    if (!initData || !tgUser) {
      setStatus("no-auth");
      return;
    }

    setUser(tgUser);

    if (DESKTOP_PLATFORMS.includes(platform)) {
      redirectToBrowser(initData, tg);
    } else {
      setStatus("mobile");
    }
  }, []);

  async function redirectToBrowser(initData, tg) {
    setStatus("redirecting");

    try {
      const loginResp = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ init_data: initData }),
      });

      if (!loginResp.ok) throw new Error("Login failed");
      const { access_token } = await loginResp.json();

      const sessionResp = await fetch(`${API_BASE}/auth/browser/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${access_token}`,
        },
      });

      if (!sessionResp.ok) throw new Error("Session failed");
      const { session_token } = await sessionResp.json();

      const browserUrl = `https://corpmeet.uz/auth/session/${session_token}`;
      tg.openLink(browserUrl);
      tg.close();
    } catch (err) {
      setStatus("error");
    }
  }

  if (status === "loading" || status === "redirecting") {
    return (
      <div style={{ fontFamily: "sans-serif", padding: "2rem", textAlign: "center" }}>
        <p>{status === "redirecting" ? "Открываю в браузере..." : "Загрузка..."}</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={{ fontFamily: "sans-serif", padding: "2rem", textAlign: "center" }}>
        <p>Не удалось открыть в браузере. Попробуйте ещё раз.</p>
      </div>
    );
  }

  if (status === "not-telegram" || status === "no-auth") {
    return (
      <div style={{ fontFamily: "sans-serif", padding: "2rem", textAlign: "center" }}>
        <p>Откройте через Telegram</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "sans-serif", padding: "1rem" }}>
      <h1>CorpMeet</h1>
      {user && <p>Привет, {user.first_name}! Бронирование переговорных — скоро.</p>}
    </div>
  );
}
