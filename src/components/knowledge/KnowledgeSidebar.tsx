import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, BookOpen, Plus } from "lucide-react";
import type { KbCategory } from "@/types/knowledge";

interface Props {
  categories: KbCategory[];
  counts: Record<string, number>;
  activeCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onNewCategory: () => void;
}

const KnowledgeSidebar = ({
  categories,
  counts,
  activeCategoryId,
  onSelectCategory,
  search,
  onSearchChange,
  onNewCategory,
}: Props) => {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search SOPs..."
          className="pl-8"
        />
      </div>

      <div className="space-y-1">
        <button
          onClick={() => onSelectCategory(null)}
          className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
            activeCategoryId === null ? "bg-muted font-medium" : "hover:bg-muted/60"
          }`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <BookOpen className="h-4 w-4 shrink-0" />
            <span className="truncate">All SOPs</span>
          </span>
        </button>

        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelectCategory(c.id)}
            className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
              activeCategoryId === c.id ? "bg-muted font-medium" : "hover:bg-muted/60"
            }`}
          >
            <span className="min-w-0 truncate">{c.name}</span>
            {counts[c.id] ? (
              <Badge variant="secondary" className="shrink-0">
                {counts[c.id]}
              </Badge>
            ) : null}
          </button>
        ))}
      </div>

      <Button variant="outline" size="sm" className="w-full" onClick={onNewCategory}>
        <Plus className="mr-2 h-4 w-4" /> New category
      </Button>
    </div>
  );
};

export default KnowledgeSidebar;
