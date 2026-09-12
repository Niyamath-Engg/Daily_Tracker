import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  BookOpen, PenTool, Dumbbell, GraduationCap, Smile, AlertTriangle, Sunrise, Moon,
  Check, Loader2, Plus, Trash2,
} from "lucide-react";
import { dailyService, learningService, bookService } from "@/services/api";
import { todayStr, formatLong, CATEGORIES, WORKOUT_TYPES, num } from "@/lib/helpers";

const OPEN_MAP = {
  reading: "reading", writing: "writing", workout: "workout", learning: "learning",
  good: "good", challenges: "challenges", morning: "morning", night: "night",
};

export default function DailyEntry() {
  const [params, setParams] = useSearchParams();
  const [date, setDate] = useState(params.get("date") || todayStr());
  const [reading, setReading] = useState({});
  const [writing, setWriting] = useState({});
  const [workout, setWorkout] = useState({});
  const [goodThings, setGoodThings] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [morning, setMorning] = useState({});
  const [night, setNight] = useState({});
  const [learning, setLearning] = useState([]);
  const [books, setBooks] = useState([]);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved
  const [open, setOpen] = useState(["reading", "writing"]);
  const loadedRef = useRef(false);
  const timerRef = useRef(null);

  const [newLearn, setNewLearn] = useState({ topic: "", category: "General", what_learned: "", source: "", link: "" });

  const load = useCallback(async (d) => {
    loadedRef.current = false;
    const data = await dailyService.get(d);
    const e = data.entry || {};
    setReading(e.reading || {});
    setWriting(e.writing || {});
    setWorkout(e.workout || {});
    setGoodThings(e.good_things || []);
    setChallenges(e.challenges || []);
    setMorning(e.morning_journal || {});
    setNight(e.night_journal || {});
    setLearning(data.learning || []);
    setTimeout(() => { loadedRef.current = true; }, 50);
  }, []);

  useEffect(() => { bookService.list().then(setBooks).catch(() => {}); }, []);
  useEffect(() => { load(date); }, [date, load]);

  useEffect(() => {
    const target = params.get("open");
    if (target && OPEN_MAP[target]) {
      setOpen((o) => (o.includes(OPEN_MAP[target]) ? o : [...o, OPEN_MAP[target]]));
      params.delete("open");
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // debounced autosave
  useEffect(() => {
    if (!loadedRef.current) return;
    setSaveStatus("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        await dailyService.save(date, {
          reading, writing, workout,
          good_things: goodThings, challenges,
          morning_journal: morning, night_journal: night,
        });
        setSaveStatus("saved");
      } catch {
        setSaveStatus("idle");
        toast.error("Unable to save today's entry. Please check your connection.");
      }
    }, 900);
    return () => timerRef.current && clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading, writing, workout, goodThings, challenges, morning, night]);

  const writingStatus = num(writing.pages_written) >= 1 ? "Completed" : num(writing.pages_written) > 0 || writing.topic || writing.content ? "In Progress" : "Not Started";

  const addLearning = async () => {
    if (!newLearn.what_learned && !newLearn.topic) { toast.error("Add what you learned first."); return; }
    try {
      const item = await learningService.create({ ...newLearn, date });
      setLearning((l) => [item, ...l]);
      setNewLearn({ topic: "", category: "General", what_learned: "", source: "", link: "" });
      toast.success("Learning added");
    } catch { toast.error("Could not add learning entry."); }
  };
  const removeLearning = async (id) => {
    await learningService.remove(id);
    setLearning((l) => l.filter((x) => x.learning_id !== id));
  };

  const readingProgress = num(reading.total_pages) > 0 ? Math.min(100, Math.round((num(reading.pages_read) / num(reading.total_pages)) * 100)) : 0;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Daily Entry</h1>
          <p className="text-sm text-slate-500 mt-1">{formatLong(date)}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 min-w-[92px]">
            {saveStatus === "saving" && (<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>)}
            {saveStatus === "saved" && (<><Check className="h-3.5 w-3.5 text-emerald-500" /> Saved</>)}
          </div>
          <Input
            type="date"
            data-testid="daily-date-picker"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
            className="w-[170px]"
          />
        </div>
      </div>

      <Accordion type="multiple" value={open} onValueChange={setOpen} className="space-y-3">
        {/* READING */}
        <Section value="reading" icon={BookOpen} title="Book Reading" badge={num(reading.pages_read) > 0 ? `${reading.pages_read} pages` : null} tint="text-emerald-600">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Book">
              <Input data-testid="reading-book" list="book-list" value={reading.book || ""} onChange={(e) => {
                const b = books.find((x) => x.title === e.target.value);
                setReading({ ...reading, book: e.target.value, ...(b ? { author: b.author, total_pages: b.total_pages, book_id: b.book_id } : {}) });
              }} placeholder="Book title" />
              <datalist id="book-list">{books.map((b) => <option key={b.book_id} value={b.title} />)}</datalist>
            </Field>
            <Field label="Author"><Input data-testid="reading-author" value={reading.author || ""} onChange={(e) => setReading({ ...reading, author: e.target.value })} placeholder="Author" /></Field>
            <Field label="Pages read today"><Input data-testid="reading-pages" type="number" min="0" value={reading.pages_read ?? ""} onChange={(e) => setReading({ ...reading, pages_read: e.target.value === "" ? "" : Math.max(0, num(e.target.value)) })} /></Field>
            <Field label="Total pages"><Input data-testid="reading-total" type="number" min="0" value={reading.total_pages ?? ""} onChange={(e) => setReading({ ...reading, total_pages: e.target.value === "" ? "" : Math.max(0, num(e.target.value)) })} /></Field>
            <Field label="Reading time (min)"><Input data-testid="reading-minutes" type="number" min="0" value={reading.minutes ?? ""} onChange={(e) => setReading({ ...reading, minutes: e.target.value === "" ? "" : Math.max(0, num(e.target.value)) })} /></Field>
            <Field label="Key takeaway"><Input data-testid="reading-takeaway" value={reading.takeaway || ""} onChange={(e) => setReading({ ...reading, takeaway: e.target.value })} placeholder="One key idea" /></Field>
          </div>
          <Field label="Reading notes"><Textarea data-testid="reading-notes" value={reading.notes || ""} onChange={(e) => setReading({ ...reading, notes: e.target.value })} rows={2} placeholder="Notes…" /></Field>
          {num(reading.total_pages) > 0 && (
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${readingProgress}%` }} /></div>
              <span className="font-num">{readingProgress}%</span>
            </div>
          )}
        </Section>

        {/* WRITING */}
        <Section value="writing" icon={PenTool} title="Write 1 Page" badge={writingStatus} tint="text-blue-600" badgeTone={writingStatus === "Completed" ? "green" : "default"}>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <div className="text-sm text-slate-700">Daily Writing Goal {num(writing.pages_written) >= 1 && <span className="text-emerald-600 font-medium">✓ Completed</span>}</div>
            <div className="text-sm font-num text-slate-900">{num(writing.pages_written)} / 1 page</div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Pages written"><Input data-testid="writing-pages" type="number" min="0" value={writing.pages_written ?? ""} onChange={(e) => setWriting({ ...writing, pages_written: e.target.value === "" ? "" : Math.max(0, num(e.target.value)), completed: num(e.target.value) >= 1 })} /></Field>
            <Field label="Word count"><Input data-testid="writing-words" type="number" min="0" value={writing.word_count ?? ""} onChange={(e) => setWriting({ ...writing, word_count: e.target.value === "" ? "" : Math.max(0, num(e.target.value)) })} /></Field>
            <Field label="Topic"><Input data-testid="writing-topic" value={writing.topic || ""} onChange={(e) => setWriting({ ...writing, topic: e.target.value })} placeholder="What are you writing about?" /></Field>
          </div>
          <Field label="Writing content"><Textarea data-testid="writing-content" value={writing.content || ""} onChange={(e) => setWriting({ ...writing, content: e.target.value })} rows={4} placeholder="Write your page…" /></Field>
        </Section>

        {/* WORKOUT */}
        <Section value="workout" icon={Dumbbell} title="Workout" badge={workout.completed ? "Done" : null} tint="text-orange-600" badgeTone="orange">
          <ToggleRow label="Workout completed?" checked={!!workout.completed} onChange={(v) => setWorkout({ ...workout, completed: v })} testid="workout-toggle" />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Workout type">
              <Select value={workout.type || ""} onValueChange={(v) => setWorkout({ ...workout, type: v })}>
                <SelectTrigger data-testid="workout-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{WORKOUT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Duration (min)"><Input data-testid="workout-duration" type="number" min="0" value={workout.duration ?? ""} onChange={(e) => setWorkout({ ...workout, duration: e.target.value === "" ? "" : Math.max(0, num(e.target.value)) })} /></Field>
            <Field label="Body weight (kg)"><Input data-testid="workout-weight" type="number" min="0" step="0.1" value={workout.weight ?? ""} onChange={(e) => setWorkout({ ...workout, weight: e.target.value === "" ? "" : Math.max(0, num(e.target.value)) })} /></Field>
            <Field label="Calories burned"><Input data-testid="workout-calories" type="number" min="0" value={workout.calories ?? ""} onChange={(e) => setWorkout({ ...workout, calories: e.target.value === "" ? "" : Math.max(0, num(e.target.value)) })} /></Field>
          </div>
          <Field label="Exercises"><Input data-testid="workout-exercises" value={workout.exercises || ""} onChange={(e) => setWorkout({ ...workout, exercises: e.target.value })} placeholder="e.g. Squats, Bench, Run" /></Field>
          <Field label="Workout notes"><Textarea data-testid="workout-notes" value={workout.notes || ""} onChange={(e) => setWorkout({ ...workout, notes: e.target.value })} rows={2} /></Field>
        </Section>

        {/* LEARNING */}
        <Section value="learning" icon={GraduationCap} title="Learning" badge={learning.length ? `${learning.length}` : null} tint="text-violet-600" badgeTone="violet">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="What did I learn?"><Input data-testid="learning-what" value={newLearn.what_learned} onChange={(e) => setNewLearn({ ...newLearn, what_learned: e.target.value })} placeholder="Insight or lesson" /></Field>
            <Field label="Topic"><Input data-testid="learning-topic" value={newLearn.topic} onChange={(e) => setNewLearn({ ...newLearn, topic: e.target.value })} placeholder="Topic" /></Field>
            <Field label="Category">
              <Select value={newLearn.category} onValueChange={(v) => setNewLearn({ ...newLearn, category: v })}>
                <SelectTrigger data-testid="learning-category"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Source / Link"><Input data-testid="learning-source" value={newLearn.source} onChange={(e) => setNewLearn({ ...newLearn, source: e.target.value })} placeholder="Book, article, video…" /></Field>
          </div>
          <Button data-testid="add-learning-btn" onClick={addLearning} className="bg-violet-600 hover:bg-violet-700"><Plus className="h-4 w-4 mr-1.5" /> Add learning</Button>
          <div className="space-y-2 mt-2">
            {learning.map((l) => (
              <div key={l.learning_id} data-testid={`learning-item-${l.learning_id}`} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                <div>
                  <div className="flex items-center gap-2"><Badge variant="secondary" className="text-[10px]">{l.category}</Badge><span className="text-sm font-medium text-slate-900">{l.topic}</span></div>
                  <div className="text-sm text-slate-600 mt-0.5">{l.what_learned}</div>
                </div>
                <button onClick={() => removeLearning(l.learning_id)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </Section>

        {/* GOOD THINGS */}
        <Section value="good" icon={Smile} title="Good Things Today" badge={goodThings.length ? `${goodThings.length}` : null} tint="text-emerald-600">
          <ListEditor
            items={goodThings} setItems={setGoodThings} testid="good"
            template={{ what: "", why: "", notes: "" }}
            fields={[{ key: "what", label: "What good thing happened?" }, { key: "why", label: "Why did it matter?" }, { key: "notes", label: "Notes", optional: true }]}
            addLabel="Add good thing" tone="emerald"
          />
        </Section>

        {/* CHALLENGES */}
        <Section value="challenges" icon={AlertTriangle} title="Challenges Today" badge={challenges.length ? `${challenges.length}` : null} tint="text-red-500">
          <ListEditor
            items={challenges} setItems={setChallenges} testid="challenge"
            template={{ what: "", why: "", learned: "", differently: "" }}
            fields={[{ key: "what", label: "What happened?" }, { key: "why", label: "Why was it a problem?" }, { key: "learned", label: "What did I learn?" }, { key: "differently", label: "What can I do differently?" }]}
            addLabel="Add challenge" tone="red"
          />
        </Section>

        {/* MORNING JOURNAL */}
        <Section value="morning" icon={Sunrise} title="Morning Journal" tint="text-amber-500">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="How do I feel today?"><Input data-testid="morning-feeling" value={morning.feeling || ""} onChange={(e) => setMorning({ ...morning, feeling: e.target.value })} /></Field>
            <Field label="Intention for today"><Input data-testid="morning-intention" value={morning.intention || ""} onChange={(e) => setMorning({ ...morning, intention: e.target.value })} /></Field>
          </div>
          <Field label="Top 3 priorities"><Textarea data-testid="morning-priorities" value={morning.priorities || ""} onChange={(e) => setMorning({ ...morning, priorities: e.target.value })} rows={3} placeholder={"1.\n2.\n3."} /></Field>
          <Field label="Morning journal"><Textarea data-testid="morning-entry" value={morning.entry || ""} onChange={(e) => setMorning({ ...morning, entry: e.target.value })} rows={5} placeholder="Write freely…" className="leading-relaxed" /></Field>
        </Section>

        {/* NIGHT JOURNAL */}
        <Section value="night" icon={Moon} title="Night Journal" tint="text-indigo-500">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="How was my day?"><Input data-testid="night-day" value={night.day || ""} onChange={(e) => setNight({ ...night, day: e.target.value })} /></Field>
            <Field label="What went well?"><Input data-testid="night-well" value={night.went_well || ""} onChange={(e) => setNight({ ...night, went_well: e.target.value })} /></Field>
            <Field label="What didn't go well?"><Input data-testid="night-notwell" value={night.not_well || ""} onChange={(e) => setNight({ ...night, not_well: e.target.value })} /></Field>
            <Field label="What am I grateful for?"><Input data-testid="night-grateful" value={night.grateful || ""} onChange={(e) => setNight({ ...night, grateful: e.target.value })} /></Field>
          </div>
          <Field label="What should I improve tomorrow?"><Input data-testid="night-improve" value={night.improve || ""} onChange={(e) => setNight({ ...night, improve: e.target.value })} /></Field>
          <Field label="Night journal"><Textarea data-testid="night-entry" value={night.entry || ""} onChange={(e) => setNight({ ...night, entry: e.target.value })} rows={5} placeholder="Reflect on your day…" className="leading-relaxed" /></Field>
        </Section>
      </Accordion>
    </div>
  );
}

function Section({ value, icon: Icon, title, badge, tint, badgeTone = "default", children }) {
  const toneCls = { green: "bg-emerald-50 text-emerald-700", orange: "bg-orange-50 text-orange-700", violet: "bg-violet-50 text-violet-700", red: "bg-red-50 text-red-700", default: "bg-slate-100 text-slate-600" }[badgeTone];
  return (
    <AccordionItem value={value} className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
      <AccordionTrigger data-testid={`section-${value}`} className="px-5 py-4 hover:no-underline">
        <div className="flex items-center gap-3">
          <Icon className={`h-5 w-5 ${tint}`} />
          <span className="font-medium text-slate-900">{title}</span>
          {badge && <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${toneCls}`}>{badge}</span>}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-5 space-y-4">{children}</AccordionContent>
    </AccordionItem>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <Label className="text-slate-600 text-xs font-semibold uppercase tracking-wide">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange, testid }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-700">{label}</span>
      <Switch data-testid={testid} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ListEditor({ items, setItems, template, fields, addLabel, tone, testid }) {
  const add = () => setItems([...items, { ...template }]);
  const update = (i, key, val) => setItems(items.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)));
  const remove = (i) => setItems(items.filter((_, idx) => idx !== i));
  const btn = tone === "red" ? "bg-red-500 hover:bg-red-600" : "bg-emerald-600 hover:bg-emerald-700";
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} data-testid={`${testid}-item-${i}`} className="rounded-lg border border-slate-200 p-3 space-y-3 relative">
          <button onClick={() => remove(i)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
          {fields.map((f) => (
            <div key={f.key}>
              <Label className="text-slate-600 text-xs">{f.label}</Label>
              <Input data-testid={`${testid}-${f.key}-${i}`} className="mt-1" value={it[f.key] || ""} onChange={(e) => update(i, f.key, e.target.value)} />
            </div>
          ))}
        </div>
      ))}
      <Button data-testid={`add-${testid}-btn`} onClick={add} className={btn}><Plus className="h-4 w-4 mr-1.5" /> {addLabel}</Button>
    </div>
  );
}
