import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Check, Loader2, GripVertical } from "lucide-react";
import { substackService } from "@/services/api";
import { SUBSTACK_STATUSES } from "@/lib/helpers";
import { PageHeader, StatCard } from "@/components/shared";

const STATUS_COLORS = {
  IDEA: "border-t-slate-400", RESEARCH: "border-t-sky-400", OUTLINE: "border-t-indigo-400",
  DRAFTING: "border-t-blue-500", EDITING: "border-t-amber-500", READY: "border-t-emerald-500", PUBLISHED: "border-t-purple-500",
};

export default function Substack() {
  const [params, setParams] = useSearchParams();
  const [articles, setArticles] = useState([]);
  const [active, setActive] = useState(null);
  const [form, setForm] = useState({});
  const [status, setStatus] = useState("idle");
  const [dragId, setDragId] = useState(null);
  const timer = useRef(null);
  const loaded = useRef(false);

  const refresh = () => substackService.list().then(setArticles);
  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (params.get("add") === "1") { addArticle(); params.delete("add"); setParams(params, { replace: true }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addArticle = async () => {
    const a = await substackService.create({ title: "Untitled article" });
    refresh();
    openEditor(a);
  };

  const openEditor = (a) => { loaded.current = false; setActive(a); setForm(a); setTimeout(() => { loaded.current = true; }, 50); };

  // autosave editor
  useEffect(() => {
    if (!loaded.current || !active) return;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try { await substackService.update(active.article_id, form); setStatus("saved"); refresh(); }
      catch { setStatus("idle"); }
    }, 900);
    return () => timer.current && clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const move = async (id, newStatus) => {
    setArticles((arr) => arr.map((a) => (a.article_id === id ? { ...a, status: newStatus } : a)));
    await substackService.update(id, { status: newStatus });
    refresh();
  };
  const remove = async (id) => { await substackService.remove(id); setActive(null); refresh(); };

  const wordCount = (form.draft || "").trim() ? form.draft.trim().split(/\s+/).length : 0;
  const counts = {
    ideas: articles.filter((a) => a.status === "IDEA").length,
    progress: articles.filter((a) => !["IDEA", "READY", "PUBLISHED"].includes(a.status)).length,
    ready: articles.filter((a) => a.status === "READY").length,
    published: articles.filter((a) => a.status === "PUBLISHED").length,
  };

  return (
    <div>
      <PageHeader title="Substack" subtitle="Your writing pipeline — drag cards to update status">
        <Button data-testid="add-article-btn" onClick={addArticle} className="bg-blue-600 hover:bg-blue-700"><Plus className="h-4 w-4 mr-1.5" /> New Article</Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard testid="ss-ideas" label="Total ideas" value={counts.ideas} />
        <StatCard testid="ss-progress" label="In progress" value={counts.progress} />
        <StatCard testid="ss-ready" label="Ready to publish" value={counts.ready} accent="text-emerald-500" />
        <StatCard testid="ss-published" label="Published" value={counts.published} accent="text-purple-500" />
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {SUBSTACK_STATUSES.map((s) => {
          const items = articles.filter((a) => a.status === s);
          return (
            <div
              key={s}
              data-testid={`kanban-col-${s}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragId) { move(dragId, s); setDragId(null); } }}
              className="w-64 shrink-0"
            >
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{s}</span>
                <span className="text-xs text-slate-400 font-num">{items.length}</span>
              </div>
              <div className="space-y-2 min-h-[80px] rounded-xl bg-slate-100/60 p-2">
                {items.map((a) => (
                  <Card
                    key={a.article_id}
                    data-testid={`article-card-${a.article_id}`}
                    draggable
                    onDragStart={() => setDragId(a.article_id)}
                    onClick={() => openEditor(a)}
                    className={`p-3 cursor-pointer border-t-2 ${STATUS_COLORS[s]} hover:shadow-md transition-shadow`}
                  >
                    <div className="flex items-start gap-1.5">
                      <GripVertical className="h-4 w-4 text-slate-300 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 leading-snug">{a.title}</div>
                        {a.category && <div className="text-[11px] text-slate-400 mt-1">{a.category}</div>}
                      </div>
                    </div>
                  </Card>
                ))}
                {!items.length && <div className="text-xs text-slate-300 text-center py-4">Drop here</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Editor */}
      <Dialog open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-6">
              Article Editor
              <span className="flex items-center gap-1.5 text-xs font-normal text-slate-400">
                {status === "saving" && <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>}
                {status === "saved" && <><Check className="h-3.5 w-3.5 text-emerald-500" /> Saved</>}
              </span>
            </DialogTitle>
            <DialogDescription className="sr-only">Edit your Substack article draft.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input data-testid="article-title-input" value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Article title" className="text-lg font-medium" />
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="mt-1.5" data-testid="article-status"><SelectValue /></SelectTrigger>
                  <SelectContent>{SUBSTACK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Category</Label><Input value={form.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1.5" /></div>
              <div><Label>Target date</Label><Input type="date" value={form.target_date || ""} onChange={(e) => setForm({ ...form, target_date: e.target.value })} className="mt-1.5" /></div>
              <div><Label>Article URL</Label><Input value={form.article_url || ""} onChange={(e) => setForm({ ...form, article_url: e.target.value })} placeholder="https://…" className="mt-1.5" /></div>
            </div>
            <div><Label>Idea</Label><Textarea rows={2} value={form.idea || ""} onChange={(e) => setForm({ ...form, idea: e.target.value })} className="mt-1.5" /></div>
            <div>
              <div className="flex items-center justify-between"><Label>Draft</Label><span className="text-xs text-slate-400 font-num">{wordCount} words</span></div>
              <Textarea rows={12} data-testid="article-draft" value={form.draft || ""} onChange={(e) => setForm({ ...form, draft: e.target.value })} placeholder="Write your article… (Markdown supported)" className="mt-1.5 leading-relaxed font-num text-[13px]" />
            </div>
            <div><Label>Notes</Label><Textarea rows={2} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1.5" /></div>
          </div>
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button variant="ghost" className="text-red-500 hover:text-red-600" data-testid="delete-article-btn" onClick={() => remove(active.article_id)}><Trash2 className="h-4 w-4 mr-1.5" /> Delete</Button>
            <Button onClick={() => setActive(null)} className="bg-blue-600 hover:bg-blue-700">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
