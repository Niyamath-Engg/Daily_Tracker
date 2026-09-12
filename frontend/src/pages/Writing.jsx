import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PenTool, Flame, Check, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { dailyService, statsService } from "@/services/api";
import { todayStr, num, formatShort } from "@/lib/helpers";
import { PageHeader, StatCard } from "@/components/shared";

export default function Writing() {
  const [stats, setStats] = useState(null);
  const [daily, setDaily] = useState([]);
  const [writing, setWriting] = useState({});
  const [status, setStatus] = useState("idle");
  const loaded = useRef(false);
  const timer = useRef(null);
  const today = todayStr();

  useEffect(() => {
    statsService.get().then(setStats).catch(() => {});
    dailyService.list().then(setDaily).catch(() => {});
    dailyService.get(today).then((d) => { setWriting((d.entry || {}).writing || {}); setTimeout(() => { loaded.current = true; }, 50); });
  }, [today]);

  useEffect(() => {
    if (!loaded.current) return;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try { await dailyService.save(today, { writing }); setStatus("saved"); dailyService.list().then(setDaily); }
      catch { setStatus("idle"); toast.error("Unable to save writing."); }
    }, 900);
    return () => timer.current && clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writing]);

  const wordCount = (writing.content || "").trim() ? (writing.content || "").trim().split(/\s+/).length : 0;
  const setContent = (v) => setWriting({ ...writing, content: v, word_count: v.trim() ? v.trim().split(/\s+/).length : 0 });

  const now = new Date();
  const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
  const monthAgo = new Date(now); monthAgo.setDate(now.getDate() - 30);
  const pagesIn = (from) => daily.filter((e) => new Date(e.date + "T00:00:00") >= from).reduce((s, e) => s + num((e.writing || {}).pages_written), 0);

  const chartData = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const e = daily.find((x) => x.date === ds);
    chartData.push({ date: formatShort(ds), pages: num((e?.writing || {}).pages_written) });
  }

  return (
    <div>
      <PageHeader title="Writing" subtitle="Write at least one page a day" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard testid="wr-streak" label="Writing streak" value={`${stats?.writing_streak ?? 0}d`} icon={Flame} accent="text-orange-500" />
        <StatCard testid="wr-week" label="Pages this week" value={pagesIn(weekAgo)} />
        <StatCard testid="wr-total" label="Total pages" value={stats?.total_pages_written ?? 0} />
        <StatCard testid="wr-words" label="Total words" value={(stats?.total_words ?? 0).toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><PenTool className="h-4 w-4 text-blue-600" /><span className="font-medium text-slate-900">Today's Writing</span></div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              {status === "saving" && <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>}
              {status === "saved" && <><Check className="h-3.5 w-3.5 text-emerald-500" /> Saved</>}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5 mb-3 text-sm">
            <span className="text-slate-700">Daily Goal {num(writing.pages_written) >= 1 && <span className="text-emerald-600 font-medium">✓ Completed</span>}</span>
            <span className="font-num text-slate-900">{num(writing.pages_written)} / 1 page</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><Label className="text-xs text-slate-600">Pages written</Label><Input data-testid="writing-pages-quick" type="number" min="0" value={writing.pages_written ?? ""} onChange={(e) => setWriting({ ...writing, pages_written: e.target.value === "" ? "" : Math.max(0, num(e.target.value)) })} className="mt-1" /></div>
            <div><Label className="text-xs text-slate-600">Topic</Label><Input data-testid="writing-topic-quick" value={writing.topic || ""} onChange={(e) => setWriting({ ...writing, topic: e.target.value })} className="mt-1" /></div>
          </div>
          <Textarea data-testid="writing-editor" value={writing.content || ""} onChange={(e) => setContent(e.target.value)} rows={10} placeholder="Start writing your page…" className="leading-relaxed" />
          <div className="text-xs text-slate-400 mt-2 text-right font-num">{wordCount} words</div>
        </Card>

        <Card className="p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">Pages written (last 14 days)</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} interval={1} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={24} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "none", background: "#0f172a", color: "#fff", fontSize: 12 }} />
              <Bar dataKey="pages" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
