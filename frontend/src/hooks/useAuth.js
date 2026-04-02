import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { storage } from "../lib/storage";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = storage.getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    apiFetch("/auth/me")
      .then((res) => {
        if (res.ok) return res.json();
        storage.removeToken();
        return null;
      })
      .then((data) => setUser(data))
      .catch(() => {
        storage.removeToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = () => {
    storage.removeToken();
    setUser(null);
    window.location.href = "/login";
  };

  return { user, loading, isAuthenticated: !!user, logout };
}
