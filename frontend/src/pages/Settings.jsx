import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Target, Ruler, Database, Download, LogOut, Sparkles, Trash2 } from "lucide-react";
import {
  settingsService, demoService, dailyService, bookService, learningService, monitoringService, substackService, statsService,
} from "@/services/api";
import { PageHeader } from "@/components/shared";
import { useAuth } from "@/context/AuthContext";

function toCSV(rows) {
  if (!rows.length) return "";
  const flat = rows.map((r) => {
    const o = {};
    Object.entries(r).forEach(([k, v]) => { o[k] = v && typeof v === "object" ? JSON.stringify(v) : v; });
    return o;
  });
  const cols = [...new Set(flat.flatMap((r) => Object.keys(r)))];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...flat.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
function download(name, content, type = "text/csv") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function Settings() {
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState(null);
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    settingsService.get().then(setSettings).catch(() => {});
    statsService.get().then(setStats).catch(() => {});
  }, []);

  const save = async (next) => { setSettings(next); await settingsService.update(next); };
  const toggleGoal = (key) => save({ ...settings, goals: settings.goals.map((g) => (g.key === key ? { ...g, enabled: !g.enabled } : g)) });

  const seed = async () => { setBusy(true); try { await demoService.seed(); toast.success("Demo data added"); statsService.get().then(setStats); } catch { toast.error("Could not seed demo data."); } finally { setBusy(false); } };
  const clearDemo = async () => { setBusy(true); try { await demoService.clear(); toast.success("Demo data removed"); statsService.get().then(setStats); } catch { toast.error("Could not clear demo data."); } finally { setBusy(false); } };

  const exportCSV = async (name, fetcher) => {
    try { const data = await fetcher(); download(`dailyos-${name}.csv`, toCSV(Array.isArray(data) ? data : [])); }
    catch { toast.error("Export failed."); }
  };
  const exportJSON = async () => {
    try {
      const [daily, books, learning, monitoring, substack] = await Promise.all([
        dailyService.list(), bookService.list(), learningService.list(), monitoringService.list(), substackService.list(),
      ]);
      download("dailyos-backup.json", JSON.stringify({ daily, books, learning, monitoring, substack }, null, 2), "application/json");
    } catch { toast.error("Backup failed."); }
  };

  if (!settings) return null;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" subtitle="Configure your goals, units and data" />

      <div className="space-y-5">
        {/* Statistics overview */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4"><Sparkles className="h-4 w-4 text-blue-600" /><span className="font-medium text-slate-900">Overall Statistics</span></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              ["Days tracked", stats?.days_tracked], ["Avg completion", `${stats?.avg_completion ?? 0}%`],
              ["Books", stats?.total_books], ["Pages read", stats?.total_pages_read],
              ["Pages written", stats?.total_pages_written], ["Words", (stats?.total_words ?? 0).toLocaleString()],
              ["Workouts", stats?.total_workouts], ["Learnings", stats?.total_learning],
            ].map(([l, v]) => (
              <div key={l}><div className="text-xl font-bold font-num text-slate-900">{v ?? 0}</div><div className="text-xs text-slate-500 mt-0.5">{l}</div></div>
            ))}
          </div>
        </Card>

        {/* Goals */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4"><Target className="h-4 w-4 text-blue-600" /><span className="font-medium text-slate-900">Daily Goals</span></div>
          <p className="text-sm text-slate-500 mb-4">Daily progress only counts enabled goals.</p>
          <div className="space-y-1">
            {settings.goals.map((g) => (
              <div key={g.key} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <span className="text-sm text-slate-700">{g.label}</span>
                <Switch data-testid={`goal-toggle-${g.key}`} checked={g.enabled} onCheckedChange={() => toggleGoal(g.key)} />
              </div>
            ))}
          </div>
        </Card>

        {/* Units */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4"><Ruler className="h-4 w-4 text-blue-600" /><span className="font-medium text-slate-900">Units</span></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label className="text-slate-600">Weight</Label>
              <Select value={settings.weight_unit} onValueChange={(v) => save({ ...settings, weight_unit: v })}>
                <SelectTrigger className="mt-1.5" data-testid="weight-unit"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="kg">Kilograms (kg)</SelectItem><SelectItem value="lbs">Pounds (lbs)</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="text-slate-600">Distance</Label>
              <Select value={settings.distance_unit} onValueChange={(v) => save({ ...settings, distance_unit: v })}>
                <SelectTrigger className="mt-1.5" data-testid="distance-unit"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="km">Kilometres (km)</SelectItem><SelectItem value="miles">Miles</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Data */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4"><Database className="h-4 w-4 text-blue-600" /><span className="font-medium text-slate-900">Data</span></div>
          <div className="flex flex-wrap gap-2 mb-5">
            <Button variant="outline" size="sm" data-testid="seed-demo-btn" onClick={seed} disabled={busy}><Sparkles className="h-4 w-4 mr-1.5" /> Load demo data</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="outline" size="sm" className="text-red-500" data-testid="clear-demo-btn"><Trash2 className="h-4 w-4 mr-1.5" /> Remove demo data</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Remove demo data?</AlertDialogTitle><AlertDialogDescription>This removes only sample/demo records. Your own entries are kept.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={clearDemo}>Remove</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500"><Download className="h-3.5 w-3.5" /> Export</div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" data-testid="export-daily" onClick={() => exportCSV("daily-entries", dailyService.list)}>Daily CSV</Button>
            <Button variant="secondary" size="sm" data-testid="export-books" onClick={() => exportCSV("books", bookService.list)}>Books CSV</Button>
            <Button variant="secondary" size="sm" data-testid="export-learning" onClick={() => exportCSV("learning", learningService.list)}>Learning CSV</Button>
            <Button variant="secondary" size="sm" data-testid="export-monitoring" onClick={() => exportCSV("monitoring", monitoringService.list)}>Monitoring CSV</Button>
            <Button variant="secondary" size="sm" data-testid="export-substack" onClick={() => exportCSV("substack", substackService.list)}>Substack CSV</Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" data-testid="export-json" onClick={exportJSON}>Full JSON backup</Button>
          </div>
        </Card>

        {/* Account */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-900">{user?.name}</div>
              <div className="text-sm text-slate-500">{user?.email}</div>
            </div>
            <Button variant="outline" onClick={logout} data-testid="settings-logout"><LogOut className="h-4 w-4 mr-1.5" /> Log out</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
