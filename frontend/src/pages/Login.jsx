import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, PenTool, Dumbbell } from "lucide-react";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
function goGoogle() {
  const redirectUrl = window.location.origin + "/dashboard";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
}

export default function Login() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") await login({ email, password });
      else await register({ email, password, name });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-slate-900 text-white relative overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center font-display font-bold text-xl">D</div>
          <span className="font-display font-bold text-xl">Daily OS</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-4xl font-bold tracking-tight leading-tight">Track the day.<br />Build the life.</h1>
          <p className="text-slate-300 mt-4 leading-relaxed">
            Your private space to record reading, writing, workouts, learning and reflections — in about 3 minutes a night.
          </p>
          <div className="flex gap-6 mt-10">
            {[BookOpen, PenTool, Dumbbell].map((Icon, i) => (
              <div key={i} className="h-11 w-11 rounded-xl bg-white/10 flex items-center justify-center">
                <Icon className="h-5 w-5 text-blue-300" />
              </div>
            ))}
          </div>
        </div>
        <div className="text-xs text-slate-500">A calm personal dashboard for your daily habits.</div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-display font-bold text-xl">D</div>
            <span className="font-display font-bold text-xl text-slate-900">Daily OS</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {mode === "login" ? "Sign in to your private dashboard." : "Start tracking your days."}
          </p>

          <button
            data-testid="google-login-btn"
            onClick={goGoogle}
            className="mt-6 w-full flex items-center justify-center gap-3 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors"
          >
            <img src="https://www.google.com/favicon.ico" alt="" className="h-4 w-4" />
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="h-px bg-slate-200 flex-1" />
            <span className="text-xs text-slate-400">or</span>
            <div className="h-px bg-slate-200 flex-1" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <div>
                <Label htmlFor="name" className="text-slate-700">Name</Label>
                <Input id="name" data-testid="name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="mt-1.5" />
              </div>
            )}
            <div>
              <Label htmlFor="email" className="text-slate-700">Email</Label>
              <Input id="email" data-testid="email-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="password" className="text-slate-700">Password</Label>
              <Input id="password" data-testid="password-input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1.5" />
            </div>
            <button
              type="submit"
              data-testid="submit-auth-btn"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium rounded-lg px-4 py-2.5 transition-colors text-sm active:scale-[0.98]"
            >
              {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="text-sm text-slate-500 mt-6 text-center">
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              data-testid="toggle-auth-mode"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="text-blue-600 font-medium hover:underline"
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
