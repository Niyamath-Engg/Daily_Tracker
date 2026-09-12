import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Plus, Trash2, Star, Flame } from "lucide-react";
import { bookService, statsService, dailyService } from "@/services/api";
import { todayStr, num } from "@/lib/helpers";
import { PageHeader, StatCard, EmptyState } from "@/components/shared";

export default function Reading() {
  const [books, setBooks] = useState([]);
  const [stats, setStats] = useState(null);
  const [daily, setDaily] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", author: "", total_pages: "", start_date: todayStr(), status: "reading" });

  const refresh = () => bookService.list().then(setBooks);
  useEffect(() => {
    refresh();
    statsService.get().then(setStats).catch(() => {});
    dailyService.list().then(setDaily).catch(() => {});
  }, []);

  const create = async () => {
    if (!form.title) { toast.error("Book title is required."); return; }
    try { await bookService.create(form); toast.success("Book added"); setOpen(false); setForm({ title: "", author: "", total_pages: "", start_date: todayStr(), status: "reading" }); refresh(); }
    catch { toast.error("Could not add book."); }
  };
  const remove = async (id) => { await bookService.remove(id); refresh(); };
  const updateProgress = async (b, pages) => {
    const status = num(pages) >= num(b.total_pages) && num(b.total_pages) > 0 ? "completed" : b.status;
    const patch = { pages_read: num(pages), status };
    if (status === "completed" && !b.completion_date) patch.completion_date = todayStr();
    await bookService.update(b.book_id, patch);
    refresh();
  };
  const markComplete = async (b) => { await bookService.update(b.book_id, { status: "completed", pages_read: b.total_pages, completion_date: todayStr() }); refresh(); };

  const reading = books.filter((b) => b.status === "reading");
  const completed = books.filter((b) => b.status === "completed");

  const now = new Date();
  const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
  const monthAgo = new Date(now); monthAgo.setDate(now.getDate() - 30);
  const pagesInRange = (from) => daily.filter((e) => new Date(e.date + "T00:00:00") >= from).reduce((s, e) => s + num((e.reading || {}).pages_read), 0);

  return (
    <div>
      <PageHeader title="Reading" subtitle="Your books and reading progress">
        <AddBookDialog open={open} setOpen={setOpen} form={form} setForm={setForm} create={create} />
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard testid="rd-completed" label="Books completed" value={stats?.books_completed ?? 0} icon={BookOpen} />
        <StatCard testid="rd-pages" label="Total pages read" value={stats?.total_pages_read ?? 0} />
        <StatCard testid="rd-week" label="Pages this week" value={pagesInRange(weekAgo)} />
        <StatCard testid="rd-streak" label="Reading streak" value={`${stats?.reading_streak ?? 0}d`} icon={Flame} accent="text-orange-500" />
      </div>

      <h2 className="text-lg font-semibold text-slate-900 mb-3">Currently Reading</h2>
      {reading.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          {reading.map((b) => {
            const pct = num(b.total_pages) ? Math.min(100, Math.round((num(b.pages_read) / num(b.total_pages)) * 100)) : 0;
            return (
              <Card key={b.book_id} data-testid={`reading-book-${b.book_id}`} className="p-5">
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">{b.title}</div>
                    <div className="text-sm text-slate-500">{b.author}</div>
                  </div>
                  <button onClick={() => remove(b.book_id)} className="text-slate-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
                  <span className="text-sm font-num text-slate-500">{pct}%</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Input type="number" min="0" data-testid={`book-pages-${b.book_id}`} defaultValue={b.pages_read} onBlur={(e) => updateProgress(b, e.target.value)} className="w-24 h-8" />
                  <span className="text-sm text-slate-400">/ {b.total_pages} pages</span>
                  <Button size="sm" variant="outline" className="ml-auto" onClick={() => markComplete(b)} data-testid={`complete-book-${b.book_id}`}>Finish</Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : <Card className="mb-8"><EmptyState icon={BookOpen} title="No book currently being read" description="Add a book to start tracking your reading." testid="reading-empty" /></Card>}

      <h2 className="text-lg font-semibold text-slate-900 mb-3">Completed Books</h2>
      {completed.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {completed.map((b) => (
            <Card key={b.book_id} data-testid={`completed-book-${b.book_id}`} className="p-5">
              <div className="flex justify-between items-start">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 truncate">{b.title}</div>
                  <div className="text-sm text-slate-500">{b.author}</div>
                </div>
                <button onClick={() => remove(b.book_id)} className="text-slate-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((s) => <Star key={s} className={`h-4 w-4 ${s <= (b.rating || 0) ? "text-amber-400 fill-amber-400" : "text-slate-200"}`} />)}</div>
                <Badge variant="secondary">{b.review && b.review.full_review ? "Reviewed" : "No review"}</Badge>
              </div>
              {b.completion_date && <div className="text-xs text-slate-400 mt-2">Finished {b.completion_date}</div>}
            </Card>
          ))}
        </div>
      ) : <Card><EmptyState icon={BookOpen} title="No completed books yet" description="Finish a book to see it here." /></Card>}
    </div>
  );
}

function AddBookDialog({ open, setOpen, form, setForm, create }) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="add-book-btn" className="bg-blue-600 hover:bg-blue-700"><Plus className="h-4 w-4 mr-1.5" /> Add Book</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Book</DialogTitle><DialogDescription>Add a book to your reading list.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div><Label>Title</Label><Input data-testid="book-title-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1.5" /></div>
          <div><Label>Author</Label><Input data-testid="book-author-input" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className="mt-1.5" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Total pages</Label><Input data-testid="book-pages-input" type="number" min="0" value={form.total_pages} onChange={(e) => setForm({ ...form, total_pages: e.target.value })} className="mt-1.5" /></div>
            <div><Label>Start date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="mt-1.5" /></div>
          </div>
          <div><Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reading">Currently Reading</SelectItem>
                <SelectItem value="want">Want to Read</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button data-testid="save-book-btn" onClick={create} className="bg-blue-600 hover:bg-blue-700">Add Book</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
