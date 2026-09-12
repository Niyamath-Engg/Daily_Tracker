import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Trash2, ExternalLink } from "lucide-react";
import { learningService } from "@/services/api";
import { CATEGORIES, formatShort } from "@/lib/helpers";
import { PageHeader, EmptyState } from "@/components/shared";

export default function Learning() {
  const [items, setItems] = useState([]);
  const [category, setCategory] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => { learningService.list().then(setItems).catch(() => {}); }, []);

  const remove = async (id) => { await learningService.remove(id); setItems((l) => l.filter((x) => x.learning_id !== id)); toast.success("Removed"); };

  const filtered = useMemo(() => items.filter((i) => {
    if (category !== "all" && i.category !== category) return false;
    if (q && !(`${i.topic} ${i.what_learned}`.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  }), [items, category, q]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach((i) => { (map[i.date] = map[i.date] || []).push(i); });
    return Object.keys(map).sort((a, b) => b.localeCompare(a)).map((d) => ({ date: d, items: map[d] }));
  }, [filtered]);

  return (
    <div>
      <PageHeader title="Learning" subtitle="A timeline of everything you've learned">
        <Input data-testid="learning-search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="w-40" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger data-testid="learning-filter" className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </PageHeader>

      {grouped.length ? (
        <div className="relative pl-6">
          <div className="absolute left-2 top-2 bottom-2 w-px bg-slate-200" />
          <div className="space-y-8">
            {grouped.map((g) => (
              <div key={g.date} className="relative">
                <div className="absolute -left-[18px] top-1 h-3 w-3 rounded-full bg-blue-600 ring-4 ring-blue-50" />
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">{formatShort(g.date)}</div>
                <div className="space-y-3">
                  {g.items.map((i) => (
                    <Card key={i.learning_id} data-testid={`learning-card-${i.learning_id}`} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-[10px]">{i.category}</Badge>
                            {i.topic && <span className="text-sm font-medium text-slate-900">{i.topic}</span>}
                          </div>
                          <p className="text-sm text-slate-700 mt-1.5 leading-relaxed">{i.what_learned}</p>
                          {i.source && <div className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">{i.source}{i.link && <a href={i.link} target="_blank" rel="noreferrer" className="text-blue-600"><ExternalLink className="h-3 w-3" /></a>}</div>}
                        </div>
                        <button onClick={() => remove(i.learning_id)} className="text-slate-300 hover:text-red-500 shrink-0"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : <Card><EmptyState icon={GraduationCap} title="No learning entries yet" description="Add learnings from your Daily Entry to build your timeline." testid="learning-empty" /></Card>}
    </div>
  );
}
