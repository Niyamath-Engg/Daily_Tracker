import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { authService } from "@/services/api";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import DailyEntry from "@/pages/DailyEntry";
import DailyReview from "@/pages/DailyReview";
import Reading from "@/pages/Reading";
import Writing from "@/pages/Writing";
import Exercise from "@/pages/Exercise";
import Learning from "@/pages/Learning";
import Journal from "@/pages/Journal";
import Reviews from "@/pages/Reviews";
import Monitoring from "@/pages/Monitoring";
import Substack from "@/pages/Substack";
import History from "@/pages/History";
import Settings from "@/pages/Settings";

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
    </div>
  );
}

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
function AuthCallback() {
  const navigate = useNavigate();
  const { setSessionUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    const hash = window.location.hash;
    const sessionId = new URLSearchParams(hash.replace("#", "")).get("session_id");
    (async () => {
      try {
        const data = await authService.googleSession(sessionId);
        setSessionUser(data.user, data.session_token);
        window.history.replaceState(null, "", "/dashboard");
        navigate("/dashboard", { replace: true, state: { user: data.user } });
      } catch {
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate, setSessionUser]);

  return <Loading />;
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/daily" element={<Protected><DailyEntry /></Protected>} />
      <Route path="/review" element={<Protected><DailyReview /></Protected>} />
      <Route path="/reading" element={<Protected><Reading /></Protected>} />
      <Route path="/writing" element={<Protected><Writing /></Protected>} />
      <Route path="/exercise" element={<Protected><Exercise /></Protected>} />
      <Route path="/learning" element={<Protected><Learning /></Protected>} />
      <Route path="/journal" element={<Protected><Journal /></Protected>} />
      <Route path="/reviews" element={<Protected><Reviews /></Protected>} />
      <Route path="/monitoring" element={<Protected><Monitoring /></Protected>} />
      <Route path="/substack" element={<Protected><Substack /></Protected>} />
      <Route path="/history" element={<Protected><History /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
          <Toaster position="top-right" richColors />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}
