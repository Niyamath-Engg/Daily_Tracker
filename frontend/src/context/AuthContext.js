import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authService } from "@/services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const u = await authService.me();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const applyAuth = (data) => {
    if (data.session_token) localStorage.setItem("dailyos_token", data.session_token);
    setUser(data.user);
  };

  const login = async (creds) => applyAuth(await authService.login(creds));
  const register = async (creds) => applyAuth(await authService.register(creds));
  const setSessionUser = (u, token) => {
    if (token) localStorage.setItem("dailyos_token", token);
    setUser(u);
  };
  const logout = async () => {
    try { await authService.logout(); } catch { /* ignore */ }
    localStorage.removeItem("dailyos_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setSessionUser, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
