import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { apiFetch } from "../lib/api";
import { storage } from "../lib/storage";

export default function SessionAuthPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) { navigate("/login", { replace: true }); return; }

    apiFetch(`/auth/session/${token}`)
      .then(res => { if (res.ok) return res.json(); throw new Error("invalid"); })
      .then(data => {
        storage.setToken(data.access_token);
        navigate("/bookings", { replace: true });
      })
      .catch(() => {
        setError("Ссылка недействительна или истекла");
        setTimeout(() => navigate("/login", { replace: true }), 2000);
      });
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "var(--bg)" }}>
      {error ? (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="text-sm font-semibold" style={{ color: "var(--danger)" }}>
          {error}
        </motion.p>
      ) : (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 rounded-full border-2"
          style={{ borderColor: "rgba(37,99,235,0.3)", borderTopColor: "rgba(37,99,235,0.8)" }}
        />
      )}
    </div>
  );
}
