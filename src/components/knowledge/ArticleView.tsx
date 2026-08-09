import { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pencil, History, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { deleteArticle } from "@/services/knowledgeService";
import { hasRole } from "@/lib/roles";
import { useAuth } from "@/contexts/AuthContext";
import MarkdownView from "./MarkdownView";
import ChecklistPanel from "./ChecklistPanel";
import VersionHistoryDialog from "./VersionHistoryDialog";
import type { KbArticle } from "@/types/knowledge";

interface Props {
  article: KbArticle;
  onEdit: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}

const ArticleView = ({ article, onEdit, onChanged, onDeleted }: Props) => {
  const { userProfile } = useAuth();
  const [historyOpen, setHistoryOpen] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm("Delete this SOP? This cannot be undone.")) return;
    try {
      await deleteArticle(article.id);
      toast.success("SOP deleted");
      onDeleted();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not delete the SOP");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-semibold sm:text-2xl">{article.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {article.category?.name && <Badge variant="secondary">{article.category.name}</Badge>}
            {article.status === "draft" && <Badge variant="outline">Draft</Badge>}
            <span>Updated {format(new Date(article.updated_at), "d MMM yyyy HH:mm")}</span>
          </div>
          {article.summary && (
            <p className="mt-2 break-words text-sm text-muted-foreground">{article.summary}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setHistoryOpen(true)}>
            <History className="mr-2 h-4 w-4" /> History
          </Button>
          <Button size="sm" onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
          {hasRole(userProfile, "admin") && (
            <Button size="sm" variant="ghost" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>

      <ChecklistPanel articleId={article.id} articleTitle={article.title} onChanged={onChanged} />

      <Card>
        <CardContent className="pt-4">
          <MarkdownView content={article.body} />
        </CardContent>
      </Card>

      {Array.isArray(article.related_links) && article.related_links.length > 0 && (
        <Card>
          <CardContent className="space-y-1 pt-4">
            <p className="text-sm font-medium">Related pages</p>
            {article.related_links.map((l, i) => (
              <a
                key={i}
                href={l.href}
                className="flex items-center gap-2 break-all text-sm text-courier-600 underline"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" /> {l.label}
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      <VersionHistoryDialog
        articleId={article.id}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onRestored={onChanged}
      />
    </div>
  );
};

export default ArticleView;
