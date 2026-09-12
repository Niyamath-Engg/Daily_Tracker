import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { dailyService } from "@/services/api";
import { formatLong, num } from "@/lib/helpers";
import { PageHeader } from "@/components/shared";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function History() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [selected, setSelected] = useState(null);

  const refresh = () => dailyService.list().then(setEntries);
  useEffect(() => { refresh(); }, []);

  const map = useMemo(() => { const o = {}; entries.forEach((e) => { o[e.date] = e; }); return o; }, [entries]);

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const arr = [];
    for (let i = 0; i < startDow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      arr.push({ d, ds, entry: map[ds] });
    }
    return arr;
  }, [cursor, map]);

  const colorFor = (entry) => {
    if (!entry) return "bg-slate-50 text-slate-300";
    const score = num(entry.daily_score);
    if (score >= 80) return "bg-emerald-500 text-white";
    if (score >= 40) return "bg-emerald-200 text-emerald-900";
    if (score > 0) return "bg-amber-200 text-amber-900";
    return "bg-slate-100 text-slate-400";
  };

  const shift = (delta) => setCursor((c) => { let m = c.m + delta, y = c.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } return { y, m }; });

  const del = async () => { await dailyService.remove(selected.date); toast.success("Entry deleted"); setSelected(null); refresh(); };

  const sel = selected || {};
  const r = sel.reading || {}, w = sel.writing || {}, wk = sel.workout || {};

  return (
    <div>
      <PageHeader title="History" subtitle="Your daily records at a glance" />

      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <button data-testid="prev-month" onClick={() => shift(-1)} className="p-2 rounded-lg hover:bg-slate-100"><ChevronLeft className="h-5 w-5 text-slate-500" /></button>
          <div className="font-semibold text-slate-900">{MONTHS[cursor.m]} {cursor.y}</div>
          <button data-testid="next-month" onClick={() => shift(1)} className="p-2 rounded-lg hover:bg-slate-100"><ChevronRight className="h-5 w-5 text-slate-500" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {DOW.map((d) => <div key={d} className="text-center text-xs font-medium text-slate-400 pb-1">{d}</div>)}
          {cells.map((c, i) => c ? (
            <button
              key={c.ds}
              data-testid={`day-${c.ds}`}
              onClick={() => c.entry ? setSelected(c.entry) : navigate(`/daily?date=${c.ds}`)}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm font-num transition-transform hover:scale-105 ${colorFor(c.entry)}`}
            >
              <span>{c.d}</span>
              {c.entry && num(c.entry.daily_score) > 0 && <span className="text-[9px] opacity-80">{num(c.entry.daily_score)}%</span>}
            </button>
          ) : <div key={`e${i}`} />)}
        </div>
        <div className="flex items-center gap-4 mt-5 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-500" /> Completed</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-200" /> Partial</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-100" /> No entry</span>
        </div>
      </Card>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{selected && formatLong(selected.date)}</DialogTitle><DialogDescription>Daily record summary.</DialogDescription></DialogHeader>
          <div className="space-y-2 text-sm text-slate-700">
            <Row label="Completion" value={`${num(sel.daily_score)}%`} />
            <Row label="Reading" value={r.book ? `${r.book} · ${num(r.pages_read)} pages` : "—"} />
            <Row label="Writing" value={num(w.pages_written) ? `${num(w.pages_written)} page(s)` : "—"} />
            <Row label="Workout" value={wk.completed ? `${wk.type} · ${num(wk.duration)}min` : "—"} />
          </div>
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button variant="ghost" className="text-red-500" data-testid="delete-day-btn" onClick={del}><Trash2 className="h-4 w-4 mr-1.5" /> Delete</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" data-testid="edit-day-btn" onClick={() => navigate(`/daily?date=${selected.date}`)}><Pencil className="h-4 w-4 mr-1.5" /> View / Edit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }) {
  return <div className="flex justify-between border-b border-slate-100 pb-1.5"><span className="text-slate-400">{label}</span><span className="font-medium text-slate-800">{value}</span></div>;
}
