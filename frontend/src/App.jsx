import { useEffect, useState } from "react";

export default function App() {
  const [status, setStatus] = useState("loading...");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>CorpMeet</h1>
      <p>Сервис бронирования переговорных комнат</p>
      <p>
        API: <strong>{status}</strong>
      </p>
    </div>
  );
}
