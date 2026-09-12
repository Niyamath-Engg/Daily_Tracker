import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Dumbbell, Flame, Activity, Scale } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { dailyService, statsService } from "@/services/api";
import { num, formatShort } from "@/lib/helpers";
import { PageHeader, StatCard, EmptyState } from "@/components/shared";

const chartStyle = { borderRadius: 10, border: "none", background: "#0f172a", color: "#fff", fontSize: 12 };

export default function Exercise() {
  const [daily, setDaily] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    dailyService.list().then((d) => setDaily([...d].sort((a, b) => a.date.localeCompare(b.date)))).catch(() => {});
    statsService.get().then(setStats).catch(() => {});
  }, []);

  const workouts = daily.filter((e) => (e.workout || {}).completed);
  const weightData = daily.filter((e) => num((e.workout || {}).weight) > 0).map((e) => ({ date: formatShort(e.date), weight: num(e.workout.weight) }));
  const calData = workouts.slice(-14).map((e) => ({ date: formatShort(e.date), calories: num(e.workout.calories) }));
  const durData = workouts.slice(-14).map((e) => ({ date: formatShort(e.date), duration: num(e.workout.duration) }));

  // workouts per week (last 8 weeks)
  const perWeek = {};
  workouts.forEach((e) => {
    const d = new Date(e.date + "T00:00:00");
    const onejan = new Date(d.getFullYear(), 0, 1);
    const wk = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    const key = `W${wk}`;
    perWeek[key] = (perWeek[key] || 0) + 1;
  });
  const weekData = Object.keys(perWeek).slice(-8).map((k) => ({ week: k, count: perWeek[k] }));

  const latestWeight = weightData.length ? weightData[weightData.length - 1].weight : "—";

  return (
    <div>
      <PageHeader title="Exercise" subtitle="Your activity, weight and calories over time" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard testid="ex-total" label="Total workouts" value={stats?.total_workouts ?? 0} icon={Dumbbell} />
        <StatCard testid="ex-streak" label="Exercise streak" value={`${stats?.exercise_streak ?? 0}d`} icon={Flame} accent="text-orange-500" />
        <StatCard testid="ex-cal" label="Calories burned" value={(stats?.total_calories ?? 0).toLocaleString()} icon={Activity} accent="text-red-500" />
        <StatCard testid="ex-weight" label="Latest weight" value={`${latestWeight} kg`} icon={Scale} accent="text-slate-600" />
      </div>

      {workouts.length || weightData.length ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ChartCard title="Weight over time">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={weightData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis domain={["dataMin - 1", "dataMax + 1"]} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={chartStyle} />
                <Line type="monotone" dataKey="weight" stroke="#2563eb" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Calories burned">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={calData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={34} />
                <Tooltip contentStyle={chartStyle} />
                <Bar dataKey="calories" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Workout duration (min)">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={durData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={chartStyle} />
                <Bar dataKey="duration" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Workouts per week">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={weekData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={24} />
                <Tooltip contentStyle={chartStyle} />
                <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      ) : <Card><EmptyState icon={Dumbbell} title="No workout recorded yet" description="Log a workout from your Daily Entry to see your activity charts." /></Card>}

      {workouts.length > 0 && (
        <Card className="mt-5 p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Workout History</div>
          <div className="space-y-2">
            {[...workouts].reverse().slice(0, 15).map((e) => (
              <div key={e.date} data-testid={`workout-row-${e.date}`} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2 last:border-0">
                <span className="text-slate-500 w-24">{formatShort(e.date)}</span>
                <span className="text-slate-900 flex-1">{e.workout.type || "Workout"}</span>
                <span className="text-slate-500 font-num">{num(e.workout.duration)}min · {num(e.workout.calories)}cal{e.workout.weight ? ` · ${e.workout.weight}kg` : ""}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <Card className="p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">{title}</div>
      {children}
    </Card>
  );
}
