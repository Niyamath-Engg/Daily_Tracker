import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star } from "lucide-react";
import { bookService } from "@/services/api";
import { PageHeader, EmptyState } from "@/components/shared";

export default function Reviews() {
  const [books, setBooks] = useState([]);
  const [active, setActive] = useState(null);
  const [form, setForm] = useState({});

  const refresh = () => bookService.list().then(setBooks);
  useEffect(() => { refresh(); }, []);

  const openReview = (b) => {
    setActive(b);
    setForm({ rating: b.rating || 0, status: b.status || "completed", ...(b.review || {}) });
  };

  const save = async () => {
    const { rating, status, ...review } = form;
    await bookService.update(active.book_id, { rating, status, review, ...(status === "completed" && !active.completion_date ? {} : {}) });
    toast.success("Review saved");
    setActive(null);
    refresh();
  };

  return (
    <div>
      <PageHeader title="Book Reviews" subtitle="Capture what each book taught you" />

      {books.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {books.map((b) => (
            <Card key={b.book_id} data-testid={`review-book-${b.book_id}`} className="p-5 cursor-pointer hover:border-slate-300" onClick={() => openReview(b)}>
              <div className="flex justify-between items-start">
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 truncate">{b.title}</div>
                  <div className="text-sm text-slate-500">{b.author}</div>
                </div>
                <Badge variant="secondary" className="capitalize">{b.status}</Badge>
              </div>
              <div className="flex gap-0.5 mt-3">{[1, 2, 3, 4, 5].map((s) => <Star key={s} className={`h-4 w-4 ${s <= (b.rating || 0) ? "text-amber-400 fill-amber-400" : "text-slate-200"}`} />)}</div>
              {b.review?.full_review ? <p className="text-sm text-slate-600 mt-2 line-clamp-2">{b.review.full_review}</p> : <p className="text-sm text-slate-400 mt-2">Tap to write a review</p>}
            </Card>
          ))}
        </div>
      ) : <Card><EmptyState icon={Star} title="No books to review" description="Add books on the Reading page first." /></Card>}

      <Dialog open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{active?.title}</DialogTitle><DialogDescription>Write your review and rating for this book.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rating</Label>
              <div className="flex gap-1 mt-1.5">{[1, 2, 3, 4, 5].map((s) => <button key={s} data-testid={`review-star-${s}`} onClick={() => setForm({ ...form, rating: s })}><Star className={`h-6 w-6 ${s <= (form.rating || 0) ? "text-amber-400 fill-amber-400" : "text-slate-200"}`} /></button>)}</div>
            </div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="mt-1.5" data-testid="review-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reading">Currently Reading</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="abandoned">Abandoned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Fld label="What I liked"><Textarea rows={2} value={form.liked || ""} onChange={(e) => setForm({ ...form, liked: e.target.value })} /></Fld>
            <Fld label="What I didn't like"><Textarea rows={2} value={form.disliked || ""} onChange={(e) => setForm({ ...form, disliked: e.target.value })} /></Fld>
            <Fld label="Main lessons"><Textarea rows={2} value={form.lessons || ""} onChange={(e) => setForm({ ...form, lessons: e.target.value })} /></Fld>
            <Fld label="Favourite idea"><Input value={form.favourite_idea || ""} onChange={(e) => setForm({ ...form, favourite_idea: e.target.value })} /></Fld>
            <Fld label="Who should read this?"><Input value={form.who_should_read || ""} onChange={(e) => setForm({ ...form, who_should_read: e.target.value })} /></Fld>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
              <span className="text-sm text-slate-700">Would I recommend it?</span>
              <Switch data-testid="review-recommend" checked={!!form.recommend} onCheckedChange={(v) => setForm({ ...form, recommend: v })} />
            </div>
            <Fld label="Full review"><Textarea rows={5} data-testid="review-full" value={form.full_review || ""} onChange={(e) => setForm({ ...form, full_review: e.target.value })} className="leading-relaxed" /></Fld>
          </div>
          <DialogFooter><Button data-testid="save-review-btn" onClick={save} className="bg-blue-600 hover:bg-blue-700">Save Review</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Fld({ label, children }) {
  return <div><Label className="text-slate-600">{label}</Label><div className="mt-1.5">{children}</div></div>;
}
