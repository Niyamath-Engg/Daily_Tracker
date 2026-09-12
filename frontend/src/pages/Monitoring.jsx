import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Activity, Plus, Trash2 } from "lucide-react";
import { monitoringService } from "@/services/api";
import { todayStr, formatShort, num } from "@/lib/helpers";
import { PageHeader, EmptyState } from "@/components/shared";

const SUGGESTED = ["Weight", "Screen Time", "Sleep", "Revenue", "Expenses", "Steps", "Water", "Mood"];

export default function Monitoring() {
  const [params, setParams] = useSearchParams();
  const [records, setRecords] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ metric: "", value: "", unit: "", date: todayStr(), notes: "" });

  const refresh = () => monitoringService.list().then(setRecords);
  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (params.get("add") === "1") { setOpen(true); params.delete("add"); setParams(params, { replace: true }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async () => {
    if (!form.metric || form.value === "") { toast.error("Metric name and value are required."); return; }
    if (isNaN(Number(form.value))) { toast.error("Value must be numeric."); return; }
    try { await monitoringService.create(form); toast.success("Recorded"); setOpen(false); setForm({ metric: "", value: "", unit: "", date: todayStr(), notes: "" }); refresh(); }
    catch { toast.error("Could not save record."); }
  };
  const remove = async (id) => { await monitoringService.remove(id); refresh(); };

  const byMetric = useMemo(() => {
    const map = {};
    records.forEach((r) => { (map[r.metric] = map[r.metric] || []).push(r); });
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.date.localeCompare(b.date)));
    return map;
  }, [records]);

  return (
    <div>
      <PageHeader title="Monitoring" subtitle="Track any custom metric over time">
        <AddDialog open={open} setOpen={setOpen} form={form} setForm={setForm} create={create} metrics={Object.keys(byMetric)} />
      </PageHeader>

      {Object.keys(byMetric).length ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {Object.entries(byMetric).map(([metric, arr]) => {
            const latest = arr[arr.length - 1];
            const data = arr.map((r) => ({ date: formatShort(r.date), value: r.value }));
            return (
              <Card key={metric} data-testid={`metric-card-${metric}`} className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-medium text-slate-900">{metric}</div>
                    <div className="text-sm text-slate-400">Latest: <span className="font-num text-slate-700">{latest.value}{latest.unit ? ` ${latest.unit}` : ""}</span></div>
                  </div>
                  <span className="text-xs text-slate-400">{arr.length} records</span>
                </div>
                {arr.length >= 2 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={34} />
                      <Tooltip contentStyle={{ borderRadius: 10, border: "none", background: "#0f172a", color: "#fff", fontSize: 12 }} />
                      <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <div className="text-sm text-slate-400 py-6 text-center">Add more records to see a chart.</div>}
                <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
                  {[...arr].reverse().slice(0, 5).map((r) => (
                    <div key={r.record_id} className="flex items-center justify-between text-sm border-b border-slate-100 pb-1 last:border-0">
                      <span className="text-slate-500">{formatShort(r.date)}</span>
                      <span className="font-num text-slate-700">{r.value}{r.unit ? ` ${r.unit}` : ""}</span>
                      <button onClick={() => remove(r.record_id)} className="text-slate-300 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      ) : <Card><EmptyState icon={Activity} title="No monitoring data yet" description="Track weight, sleep, screen time, revenue or any custom metric." testid="monitoring-empty" /></Card>}
    </div>
  );
}

function AddDialog({ open, setOpen, form, setForm, create, metrics }) {
  const suggestions = [...new Set([...metrics, ...SUGGESTED])];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button data-testid="add-metric-btn" className="bg-blue-600 hover:bg-blue-700"><Plus className="h-4 w-4 mr-1.5" /> Add Data</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Monitoring Data</DialogTitle><DialogDescription>Record a value for any metric you want to track.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div><Label>Metric</Label>
            <Input data-testid="metric-name-input" list="metric-suggestions" value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })} placeholder="e.g. Weight" className="mt-1.5" />
            <datalist id="metric-suggestions">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Value</Label><Input data-testid="metric-value-input" type="number" step="any" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="mt-1.5" /></div>
            <div><Label>Unit</Label><Input data-testid="metric-unit-input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="kg, hrs…" className="mt-1.5" /></div>
          </div>
          <div><Label>Date</Label><Input type="date" value={form.date} max={todayStr()} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1.5" /></div>
          <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1.5" /></div>
        </div>
        <DialogFooter><Button data-testid="save-metric-btn" onClick={create} className="bg-blue-600 hover:bg-blue-700">Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
