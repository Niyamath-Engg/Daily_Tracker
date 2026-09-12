import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BookOpen, PenTool, Dumbbell, GraduationCap, BookMarked, Kanban,
  Sunrise, Moon, Sparkles, ArrowRight, Flame, Loader2,
} from "lucide-react";
import { dailyService, statsService, bookService, substackService, aiService, dailyService as ds } from "@/services/api";
import { todayStr, formatLong, greeting, num } from "@/lib/helpers";
import { useAuth } from "@/context/AuthContext";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [book, setBook] = useState(null);
  const [subs, setSubs] = useState([]);
  const [week, setWeek] = useState([]);
  const [summary, setSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const today = todayStr();

  useEffect(() => {
    dailyService.get(today).then(setData).catch(() => {});
    statsService.get().then(setStats).catch(() => {});
    bookService.list().then((bs) => setBook(bs.find((b) => b.status === "reading") || null)).catch(() => {});
    substackService.list().then(setSubs).catch(() => {});
    const start = new Date(); start.setDate(start.getDate() - 6);
    ds.list({ start: start.toISOString().slice(0, 10), end: today }).then(setWeek).catch(() => {});
  }, [today]);

  const score = data?.score || { completed: 0, total: 0, percent: 0, goals: {} };
  const entry = data?.entry || {};
  const learning = data?.learning || [];
  const reading = entry.reading || {};
  const writing = entry.writing || {};
  const workout = entry.workout || {};
  const nj = entry.night_journal || {};
  const mj = entry.morning_journal || {};
  const draftingArticle = subs.find((s) => s.status === "DRAFTING") || subs.find((s) => s.status !== "PUBLISHED");

  const genSummary = async () => {
    setAiLoading(true);
    try {
      const r = await aiService.dailySummary(today);
      setSummary(r.summary);
    } catch { toast.error("Unable to generate summary right now."); }
    finally { setAiLoading(false); }
  };

  const weeklyAgg = () => {
    const acc = { reading: 0, writing: 0, exercise: 0, learning: 0 };
    week.forEach((e) => {
      if (num((e.reading || {}).pages_read) > 0) acc.reading++;
      if (num((e.writing || {}).pages_written) >= 1) acc.writing++;
      if ((e.workout || {}).completed) acc.exercise++;
    });
    return acc;
  };
  const wk = weeklyAgg();
  const ring = 100 - score.percent;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">{formatLong(today)}</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-0.5">
            {greeting()}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
        </div>
        <Button data-testid="log-today-btn" onClick={() => navigate("/daily")} className="bg-blue-600 hover:bg-blue-700">
          Log Today's Entry <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>

      {/* Progress + streaks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card data-testid="progress-card" className="p-6 lg:col-span-1 flex items-center gap-6">
          <div className="relative h-24 w-24 shrink-0">
            <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round"
                strokeDasharray="100" strokeDashoffset={ring} pathLength="100" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold font-num text-slate-900">{score.percent}%</span>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Today's Progress</div>
            <div className="text-lg font-semibold text-slate-900 mt-1">{score.completed} / {score.total} completed</div>
            <div className="text-sm text-slate-400">enabled daily goals</div>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">Streaks</div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { label: "Reading", v: stats?.reading_streak },
              { label: "Writing", v: stats?.writing_streak },
              { label: "Exercise", v: stats?.exercise_streak },
              { label: "Learning", v: stats?.learning_streak },
              { label: "Journal", v: stats?.journal_streak },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="flex items-center justify-center gap-1 text-slate-900">
                  <Flame className={`h-4 w-4 ${(s.v || 0) > 0 ? "text-orange-500" : "text-slate-300"}`} />
                  <span className="text-xl font-bold font-num">{s.v ?? 0}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Tracker cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <TrackerCard testid="track-reading" icon={BookOpen} tint="text-emerald-600" bg="bg-emerald-50" title="Reading" onClick={() => navigate("/reading")}>
          {reading.book ? (
            <>
              <div className="font-medium text-slate-900">{reading.book}</div>
              <div className="text-sm text-slate-500">{num(reading.pages_read)} pages today{num(reading.total_pages) ? ` · ${Math.round((num(reading.pages_read) / num(reading.total_pages)) * 100)}% of book` : ""}</div>
            </>
          ) : <Empty text="No reading logged today" />}
        </TrackerCard>

        <TrackerCard testid="track-writing" icon={PenTool} tint="text-blue-600" bg="bg-blue-50" title="Writing" onClick={() => navigate("/writing")}>
          <div className="font-medium text-slate-900 font-num">{num(writing.pages_written)} / 1 page</div>
          <div className={`text-sm ${num(writing.pages_written) >= 1 ? "text-emerald-600" : "text-slate-500"}`}>{num(writing.pages_written) >= 1 ? "Completed" : "Pending"}{writing.word_count ? ` · ${writing.word_count} words` : ""}</div>
        </TrackerCard>

        <TrackerCard testid="track-exercise" icon={Dumbbell} tint="text-orange-600" bg="bg-orange-50" title="Exercise" onClick={() => navigate("/exercise")}>
          {workout.completed ? (
            <>
              <div className="font-medium text-slate-900">{workout.type || "Workout"} · {num(workout.duration)} min</div>
              <div className="text-sm text-slate-500">{workout.weight ? `${workout.weight} kg · ` : ""}{num(workout.calories)} cal</div>
            </>
          ) : <Empty text="No workout recorded today" />}
        </TrackerCard>

        <TrackerCard testid="track-learning" icon={GraduationCap} tint="text-violet-600" bg="bg-violet-50" title="Learning" onClick={() => navigate("/learning")}>
          {learning.length ? (
            <>
              <div className="font-medium text-slate-900">{learning.length} thing{learning.length > 1 ? "s" : ""} learned</div>
              <div className="text-sm text-slate-500 truncate">{learning[0].what_learned}</div>
            </>
          ) : <Empty text="No learning entries yet" />}
        </TrackerCard>

        <TrackerCard testid="track-journal" icon={BookMarked} tint="text-indigo-600" bg="bg-indigo-50" title="Journal" onClick={() => navigate("/journal")}>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-sm"><Sunrise className="h-4 w-4 text-amber-500" /> Morning {hasJournal(mj) ? <Check /> : <Pending />}</span>
            <span className="flex items-center gap-1.5 text-sm"><Moon className="h-4 w-4 text-indigo-500" /> Night {hasJournal(nj) ? <Check /> : <Pending />}</span>
          </div>
        </TrackerCard>

        <TrackerCard testid="track-substack" icon={Kanban} tint="text-purple-600" bg="bg-purple-50" title="Substack" onClick={() => navigate("/substack")}>
          {draftingArticle ? (
            <>
              <div className="font-medium text-slate-900 truncate">{draftingArticle.title}</div>
              <div className="text-sm text-slate-500">{draftingArticle.status}</div>
            </>
          ) : <Empty text="No Substack articles yet" />}
        </TrackerCard>
      </div>

      {/* Weekly + AI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">Weekly Progress (last 7 days)</div>
          <div className="space-y-3">
            {[
              { label: "Reading", v: wk.reading, color: "bg-emerald-500" },
              { label: "Writing", v: wk.writing, color: "bg-blue-500" },
              { label: "Exercise", v: wk.exercise, color: "bg-orange-500" },
            ].map((r) => (
              <div key={r.label} className="flex items-center gap-3">
                <span className="w-20 text-sm text-slate-600">{r.label}</span>
                <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full ${r.color}`} style={{ width: `${(r.v / 7) * 100}%` }} />
                </div>
                <span className="text-sm font-num text-slate-500 w-10 text-right">{r.v}/7</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-blue-600" /> AI Daily Summary</div>
            <Button data-testid="ai-summary-btn" size="sm" variant="outline" onClick={genSummary} disabled={aiLoading}>
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
            </Button>
          </div>
          {summary ? (
            <p data-testid="ai-summary-text" className="text-sm text-slate-700 leading-relaxed">{summary}</p>
          ) : (
            <p className="text-sm text-slate-400">Generate a warm reflection of your day based on today's entries.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function hasJournal(j) {
  return j && Object.values(j).some((v) => String(v || "").trim());
}
function Check() { return <span className="text-emerald-600 font-semibold">✓</span>; }
function Pending() { return <span className="text-slate-400">○</span>; }
function Empty({ text }) { return <div className="text-sm text-slate-400">{text}</div>; }

function TrackerCard({ icon: Icon, tint, bg, title, children, onClick, testid }) {
  return (
    <Card data-testid={testid} onClick={onClick} className="p-5 cursor-pointer hover:border-slate-300 transition-colors">
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`h-8 w-8 rounded-lg ${bg} flex items-center justify-center`}><Icon className={`h-4 w-4 ${tint}`} /></div>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</span>
      </div>
      <div className="space-y-0.5 min-h-[42px]">{children}</div>
    </Card>
  );
}
