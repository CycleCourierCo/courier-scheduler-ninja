import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";
import {
  saveChecklistItems,
  updateArticle,
  listChecklistItems,
} from "@/services/knowledgeService";
import type { KbArticle, KbCategory } from "@/types/knowledge";

interface DraftStep {
  id?: string;
  text: string;
  guidance?: string | null;
}

interface Props {
  article: KbArticle;
  categories: KbCategory[];
  onSaved: () => void;
  onCancel: () => void;
}

const ArticleEditor = ({ article, categories, onSaved, onCancel }: Props) => {
  const [title, setTitle] = useState(article.title);
  const [summary, setSummary] = useState(article.summary ?? "");
  const [body, setBody] = useState(article.body ?? "");
  const [categoryId, setCategoryId] = useState(article.category_id ?? "none");
  const [status, setStatus] = useState(article.status);
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listChecklistItems(article.id)
      .then((items) => setSteps(items.map((i) => ({ id: i.id, text: i.text, guidance: i.guidance }))))
      .catch(() => setSteps([]));
  }, [article.id]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Give the SOP a title");
      return;
    }
    setSaving(true);
    try {
      await updateArticle(article.id, {
        title: title.trim(),
        summary: summary.trim() || null,
        body,
        status: status as KbArticle["status"],
        category_id: categoryId === "none" ? null : categoryId,
      });
      await saveChecklistItems(article.id, steps);
      toast.success("SOP saved");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save the SOP");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          <X className="mr-2 h-4 w-4" /> Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No category</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as KbArticle["status"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Short summary</Label>
          <Input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="One line explaining when to use this SOP"
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Body</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={18}
            className="font-mono text-xs"
            placeholder="Write the procedure. Markdown supported: ## headings, - bullets, **bold**, [links](https://...)"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Markdown supported: ## headings, - bullets, 1. numbered steps, **bold**, links and tables.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Checklist steps</p>
              <p className="text-xs text-muted-foreground">
                Staff can start a run of these steps and tick them off as they work.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSteps((s) => [...s, { text: "" }])}
            >
              <Plus className="mr-2 h-4 w-4" /> Add step
            </Button>
          </div>

          {steps.length === 0 && (
            <p className="text-xs text-muted-foreground">No steps yet — this SOP is read-only guidance.</p>
          )}

          <div className="space-y-2">
            {steps.map((s, idx) => (
              <div key={s.id ?? `new-${idx}`} className="flex flex-wrap items-start gap-2">
                <span className="mt-2 w-5 shrink-0 text-xs text-muted-foreground">{idx + 1}.</span>
                <div className="min-w-0 flex-1 space-y-1">
                  <Input
                    value={s.text}
                    onChange={(e) =>
                      setSteps((prev) => prev.map((p, i) => (i === idx ? { ...p, text: e.target.value } : p)))
                    }
                    placeholder="What the staff member does"
                  />
                  <Input
                    value={s.guidance ?? ""}
                    onChange={(e) =>
                      setSteps((prev) =>
                        prev.map((p, i) => (i === idx ? { ...p, guidance: e.target.value } : p))
                      )
                    }
                    placeholder="Optional detail / where to click"
                    className="text-xs"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setSteps((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ArticleEditor;
