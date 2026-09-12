import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { dailyService, aiService } from "@/services/api";
import { todayStr, formatLong, num } from "@/lib/helpers";
import { PageHeader } from "@/components/shared";

const GOAL_LABELS = {
  reading: "Book Reading", writing: "Write 1 Page", exercise: "Exercise", learning: "Learn Something",
  morning_journal: "Morning Journal", night_journal: "Night Journal", good_things: "Good Things", challenges: "Challenges",
};

export default function DailyReview() {
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { setSummary(""); dailyService.get(date).then(setData).catch(() => {}); }, [date]);

  const score = data?.score || { completed: 0, total: 0, percent: 0, goals: {} };
  const entry = data?.entry || {};
  const learning = data?.learning || [];
  const reading = entry.reading || {};
  const writing = entry.writing || {};
  const workout = entry.workout || {};

  const genSummary = async () => {
    setAiLoading(true);
    try { const r = await aiService.dailySummary(date); setSummary(r.summary); }
    catch { toast.error("Unable to generate summary right now."); }
    finally { setAiLoading(false); }
  };

  return (
    <div>
      <PageHeader title="Daily Review" subtitle={formatLong(date)}>
        <Input type="date" data-testid="review-date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} className="w-[170px]" />
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">Daily Goals</div>
          <div className="space-y-2.5">
            {Object.keys(score.goals).map((k) => (
              <div key={k} className="flex items-center gap-2.5 text-sm" data-testid={`review-goal-${k}`}>
                <span className={score.goals[k] ? "text-emerald-600" : "text-slate-300"}>{score.goals[k] ? "✓" : "○"}</span>
                <span className={score.goals[k] ? "text-slate-900" : "text-slate-400"}>{GOAL_LABELS[k] || k}</span>
              </div>
            ))}
            {!Object.keys(score.goals).length && <div className="text-sm text-slate-400">No goals enabled.</div>}
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="text-3xl font-bold font-num text-slate-900">{score.percent}%</div>
            <div className="text-sm text-slate-500">Daily completion · {score.completed} / {score.total}</div>
          </div>
        </Card>

        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Block title="Today's Reading">{reading.book ? <><b>{reading.book}</b> — {num(reading.pages_read)} pages{reading.takeaway ? <div className="text-slate-500 mt-1">“{reading.takeaway}”</div> : null}</> : <Muted>No reading logged.</Muted>}</Block>
          <Block title="Today's Writing">{num(writing.pages_written) ? <>{num(writing.pages_written)} page(s){writing.topic ? ` · ${writing.topic}` : ""}{writing.word_count ? ` · ${writing.word_count} words` : ""}</> : <Muted>No writing logged.</Muted>}</Block>
          <Block title="Today's Workout">{workout.completed ? <>{workout.type} · {num(workout.duration)} min · {num(workout.calories)} cal{workout.weight ? ` · ${workout.weight} kg` : ""}</> : <Muted>No workout recorded.</Muted>}</Block>
          <Block title="Today's Learning">{learning.length ? <ul className="list-disc list-inside space-y-1">{learning.map((l) => <li key={l.learning_id}>{l.what_learned}</li>)}</ul> : <Muted>No learning entries.</Muted>}</Block>
          <Block title="Today's Highlights">{(entry.good_things || []).length ? <ul className="list-disc list-inside space-y-1">{entry.good_things.map((g, i) => <li key={i}>{g.what}</li>)}</ul> : <Muted>No highlights.</Muted>}</Block>
          <Block title="Today's Challenges">{(entry.challenges || []).length ? <ul className="list-disc list-inside space-y-1">{entry.challenges.map((c, i) => <li key={i}>{c.what}</li>)}</ul> : <Muted>No challenges.</Muted>}</Block>
        </div>
      </div>

      <Card className="p-6 mt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-blue-600" /> AI Reflection</div>
          <Button data-testid="review-ai-btn" size="sm" variant="outline" onClick={genSummary} disabled={aiLoading}>{aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}</Button>
        </div>
        {summary ? <p className="text-sm text-slate-700 leading-relaxed">{summary}</p> : <p className="text-sm text-slate-400">Generate a reflection based on this day.</p>}
      </Card>
    </div>
  );
}

function Block({ title, children }) {
  return (
    <Card className="p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{title}</div>
      <div className="text-sm text-slate-700 leading-relaxed">{children}</div>
    </Card>
  );
}
function Muted({ children }) { return <span className="text-slate-400">{children}</span>; }
