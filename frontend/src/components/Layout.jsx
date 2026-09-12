import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard, CheckSquare, BookOpen, PenTool, Dumbbell, GraduationCap,
  BookMarked, Star, Activity, Kanban, Calendar, Settings as SettingsIcon,
  Plus, LogOut, ClipboardCheck, Menu,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/daily", label: "Daily Entry", icon: CheckSquare },
  { to: "/review", label: "Daily Review", icon: ClipboardCheck },
  { to: "/reading", label: "Reading", icon: BookOpen },
  { to: "/writing", label: "Writing", icon: PenTool },
  { to: "/exercise", label: "Exercise", icon: Dumbbell },
  { to: "/learning", label: "Learning", icon: GraduationCap },
  { to: "/journal", label: "Journal", icon: BookMarked },
  { to: "/reviews", label: "Reviews", icon: Star },
  { to: "/monitoring", label: "Monitoring", icon: Activity },
  { to: "/substack", label: "Substack", icon: Kanban },
  { to: "/history", label: "History", icon: Calendar },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

const QUICK_ADD = [
  { label: "Log Reading", to: "/daily?open=reading" },
  { label: "Log Writing", to: "/daily?open=writing" },
  { label: "Log Workout", to: "/daily?open=workout" },
  { label: "Add Learning", to: "/daily?open=learning" },
  { label: "Add Good Thing", to: "/daily?open=good" },
  { label: "Add Challenge", to: "/daily?open=challenges" },
  { label: "Morning Journal", to: "/daily?open=morning" },
  { label: "Night Journal", to: "/daily?open=night" },
  { label: "Add Monitoring Data", to: "/monitoring?add=1" },
  { label: "Add Substack Article", to: "/substack?add=1" },
];

const MOBILE_NAV = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/daily", label: "Entry", icon: CheckSquare },
  { to: "/reading", label: "Reading", icon: BookOpen },
  { to: "/history", label: "History", icon: Calendar },
];

function QuickAdd({ variant = "sidebar" }) {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "sidebar" ? (
          <button
            data-testid="quick-add-btn"
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg px-4 py-2.5 transition-colors shadow-sm text-sm active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" /> Add Entry
          </button>
        ) : (
          <button
            data-testid="quick-add-fab"
            className="h-14 w-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center active:scale-95 transition-transform"
          >
            <Plus className="h-6 w-6" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variant === "sidebar" ? "start" : "end"} className="w-56">
        <DropdownMenuLabel>Quick Add</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {QUICK_ADD.map((q) => (
          <DropdownMenuItem
            key={q.label}
            data-testid={`quick-add-${q.to.split("=")[1] || "item"}`}
            onClick={() => navigate(q.to)}
          >
            {q.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (to) => location.pathname === to;
  const initials = (user?.name || user?.email || "U").slice(0, 2).toUpperCase();

  const SidebarInner = (
    <>
      <div className="px-5 py-6">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-display font-bold text-lg">D</div>
          <div>
            <div className="font-display font-bold text-slate-900 leading-none text-lg">Daily OS</div>
            <div className="text-[11px] text-slate-400 mt-1">Track the day. Build the life.</div>
          </div>
        </div>
      </div>
      <div className="px-3 pb-3">
        <QuickAdd variant="sidebar" />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <button
              key={item.to}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={() => { navigate(item.to); setMobileOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon className={cn("h-[18px] w-[18px]", active ? "text-blue-600" : "text-slate-400")} />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="p-3 border-t border-slate-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button data-testid="user-menu-btn" className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-100 transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.picture} />
                <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="text-left min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">{user?.name || "User"}</div>
                <div className="text-xs text-slate-400 truncate">{user?.email}</div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem onClick={() => navigate("/settings")} data-testid="menu-settings">
              <SettingsIcon className="h-4 w-4 mr-2" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout} data-testid="logout-btn">
              <LogOut className="h-4 w-4 mr-2" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200/80 flex-col z-40">
        {SidebarInner}
      </aside>

      {/* Mobile header */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-display font-bold">D</div>
          <span className="font-display font-bold text-slate-900">Daily OS</span>
        </div>
        <button data-testid="mobile-menu-btn" onClick={() => setMobileOpen((v) => !v)} className="p-2 rounded-lg hover:bg-slate-100">
          <Menu className="h-5 w-5 text-slate-600" />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white flex flex-col shadow-xl">
            {SidebarInner}
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="md:pl-64 min-h-screen">
        <div className="px-4 sm:px-8 py-6 max-w-7xl mx-auto pb-28 md:pb-10">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 flex items-center justify-around h-16 px-2">
        {MOBILE_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <button
              key={item.to}
              data-testid={`mnav-${item.label.toLowerCase()}`}
              onClick={() => navigate(item.to)}
              className={cn("flex flex-col items-center gap-0.5 px-3 py-1", active ? "text-blue-600" : "text-slate-400")}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
        <div className="-mt-8"><QuickAdd variant="fab" /></div>
      </nav>
    </div>
  );
}
