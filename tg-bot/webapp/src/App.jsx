import { useEffect, useState } from "react";

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      setUser(tg.initDataUnsafe?.user || null);
    }
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "1rem" }}>
      <h1>CorpMeet</h1>
      {user ? (
        <p>Привет, {user.first_name}! Бронирование переговорных — скоро.</p>
      ) : (
        <p>Откройте через Telegram</p>
      )}
    </div>
  );
}
