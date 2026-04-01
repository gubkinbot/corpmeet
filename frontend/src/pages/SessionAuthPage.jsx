import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { storage } from "../lib/storage";

export default function SessionAuthPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    apiFetch(`/auth/session/${token}`)
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Session invalid");
      })
      .then((data) => {
        storage.setToken(data.access_token);
        navigate("/bookings", { replace: true });
      })
      .catch(() => {
        setError("Ссылка недействительна или истекла");
        setTimeout(() => navigate("/login", { replace: true }), 2000);
      });
  }, [token]);

  return (
    <div
      style={{
        fontFamily: "sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
      }}
    >
      {error ? (
        <p style={{ color: "#f44336" }}>{error}</p>
      ) : (
        <p style={{ color: "#999" }}>Авторизация...</p>
      )}
    </div>
  );
}
