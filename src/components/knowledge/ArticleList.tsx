import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ListChecks, FileText } from "lucide-react";
import type { KbArticle } from "@/types/knowledge";

interface Props {
  articles: KbArticle[];
  activeId: string | null;
  onSelect: (article: KbArticle) => void;
  isLoading?: boolean;
}

const ArticleList = ({ articles, activeId, onSelect, isLoading }: Props) => {
  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading SOPs...</div>;
  }
  if (!articles.length) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No SOPs here yet. Use "New SOP" to write the first one.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {articles.map((a) => (
        <button
          key={a.id}
          onClick={() => onSelect(a)}
          className={`block w-full px-3 py-3 text-left transition-colors ${
            activeId === a.id ? "bg-muted" : "hover:bg-muted/50"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 break-words text-sm font-medium">{a.title}</span>
            {a.status === "draft" && (
              <Badge variant="outline" className="shrink-0 text-[10px]">
                Draft
              </Badge>
            )}
          </div>
          {a.summary && (
            <p className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground">{a.summary}</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {a.category?.name && <span className="truncate">{a.category.name}</span>}
            <span>Updated {format(new Date(a.updated_at), "d MMM yyyy")}</span>
          </div>
        </button>
      ))}
    </div>
  );
};

export default ArticleList;
