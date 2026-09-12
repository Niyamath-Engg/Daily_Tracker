import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sunrise, Moon, Check, Loader2, BookMarked } from "lucide-react";
import { dailyService } from "@/services/api";
import { todayStr, formatShort, formatLong } from "@/lib/helpers";
import { PageHeader, EmptyState } from "@/components/shared";

export default function Journal() {
  const [date, setDate] = useState(todayStr());
  const [morning, setMorning] = useState({});
  const [night, setNight] = useState({});
  const [status, setStatus] = useState("idle");
  const [history, setHistory] = useState([]);
  const loaded = useRef(false);
  const timer = useRef(null);

  const loadHistory = () => dailyService.list().then((d) => setHistory(d.filter((e) => hasJ(e.morning_journal) || hasJ(e.night_journal))));

  useEffect(() => {
    loaded.current = false;
    dailyService.get(date).then((d) => { setMorning((d.entry || {}).morning_journal || {}); setNight((d.entry || {}).night_journal || {}); setTimeout(() => { loaded.current = true; }, 50); });
  }, [date]);
  useEffect(() => { loadHistory(); }, []);

  useEffect(() => {
    if (!loaded.current) return;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try { await dailyService.save(date, { morning_journal: morning, night_journal: night }); setStatus("saved"); loadHistory(); }
      catch { setStatus("idle"); toast.error("Unable to save journal."); }
    }, 900);
    return () => timer.current && clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [morning, night]);

  return (
    <div>
      <PageHeader title="Journal" subtitle={formatLong(date)}>
        <div className="flex items-center gap-2 text-xs text-slate-400 min-w-[80px]">
          {status === "saving" && <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>}
          {status === "saved" && <><Check className="h-3.5 w-3.5 text-emerald-500" /> Saved</>}
        </div>
        <Input type="date" data-testid="journal-date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} className="w-[170px]" />
      </PageHeader>

      <Tabs defaultValue="morning">
        <TabsList className="mb-4">
          <TabsTrigger value="morning" data-testid="tab-morning"><Sunrise className="h-4 w-4 mr-1.5 text-amber-500" /> Morning</TabsTrigger>
          <TabsTrigger value="night" data-testid="tab-night"><Moon className="h-4 w-4 mr-1.5 text-indigo-500" /> Night</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history"><BookMarked className="h-4 w-4 mr-1.5 text-slate-500" /> Previous</TabsTrigger>
        </TabsList>

        <TabsContent value="morning">
          <Card className="p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Fld label="How do I feel today?"><Input data-testid="j-morning-feeling" value={morning.feeling || ""} onChange={(e) => setMorning({ ...morning, feeling: e.target.value })} /></Fld>
              <Fld label="Intention for today"><Input data-testid="j-morning-intention" value={morning.intention || ""} onChange={(e) => setMorning({ ...morning, intention: e.target.value })} /></Fld>
            </div>
            <Fld label="Top 3 priorities"><Textarea rows={3} data-testid="j-morning-priorities" value={morning.priorities || ""} onChange={(e) => setMorning({ ...morning, priorities: e.target.value })} placeholder={"1.\n2.\n3."} /></Fld>
            <Fld label="Morning journal"><Textarea rows={10} data-testid="j-morning-entry" value={morning.entry || ""} onChange={(e) => setMorning({ ...morning, entry: e.target.value })} className="leading-relaxed" placeholder="Write freely…" /></Fld>
          </Card>
        </TabsContent>

        <TabsContent value="night">
          <Card className="p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Fld label="How was my day?"><Input data-testid="j-night-day" value={night.day || ""} onChange={(e) => setNight({ ...night, day: e.target.value })} /></Fld>
              <Fld label="What went well?"><Input data-testid="j-night-well" value={night.went_well || ""} onChange={(e) => setNight({ ...night, went_well: e.target.value })} /></Fld>
              <Fld label="What didn't go well?"><Input value={night.not_well || ""} onChange={(e) => setNight({ ...night, not_well: e.target.value })} /></Fld>
              <Fld label="What am I grateful for?"><Input data-testid="j-night-grateful" value={night.grateful || ""} onChange={(e) => setNight({ ...night, grateful: e.target.value })} /></Fld>
            </div>
            <Fld label="What should I improve tomorrow?"><Input value={night.improve || ""} onChange={(e) => setNight({ ...night, improve: e.target.value })} /></Fld>
            <Fld label="Night journal"><Textarea rows={10} data-testid="j-night-entry" value={night.entry || ""} onChange={(e) => setNight({ ...night, entry: e.target.value })} className="leading-relaxed" placeholder="Reflect on your day…" /></Fld>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          {history.length ? (
            <div className="space-y-4">
              {history.map((e) => (
                <Card key={e.date} data-testid={`journal-history-${e.date}`} className="p-5 cursor-pointer hover:border-slate-300" onClick={() => setDate(e.date)}>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{formatShort(e.date)}</div>
                  {hasJ(e.morning_journal) && <p className="text-sm text-slate-700 leading-relaxed"><span className="text-amber-500 font-medium">Morning · </span>{e.morning_journal.entry || e.morning_journal.intention}</p>}
                  {hasJ(e.night_journal) && <p className="text-sm text-slate-700 leading-relaxed mt-1.5"><span className="text-indigo-500 font-medium">Night · </span>{e.night_journal.entry || e.night_journal.day}</p>}
                </Card>
              ))}
            </div>
          ) : <Card><EmptyState icon={BookMarked} title="No previous journals" description="Your written journals will appear here." /></Card>}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function hasJ(j) { return j && Object.values(j).some((v) => String(v || "").trim()); }
function Fld({ label, children }) {
  return <div><Label className="text-slate-600 text-xs font-semibold uppercase tracking-wide">{label}</Label><div className="mt-1.5">{children}</div></div>;
}
