import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getArticle,
  listArticles,
  listCategories,
  listChecklistItems,
  listRuns,
  listVersions,
} from "@/services/knowledgeService";

export function useKbCategories() {
  return useQuery({ queryKey: ["kb-categories"], queryFn: listCategories });
}

export function useKbArticles(params: { categoryId?: string | null; search?: string; includeDrafts?: boolean }) {
  return useQuery({
    queryKey: ["kb-articles", params],
    queryFn: () => listArticles(params),
  });
}

export function useKbArticle(idOrSlug: string | undefined) {
  return useQuery({
    queryKey: ["kb-article", idOrSlug],
    queryFn: () => getArticle(idOrSlug as string),
    enabled: !!idOrSlug,
  });
}

export function useKbChecklist(articleId: string | undefined) {
  return useQuery({
    queryKey: ["kb-checklist", articleId],
    queryFn: () => listChecklistItems(articleId as string),
    enabled: !!articleId,
  });
}

export function useKbRuns(params: { articleId?: string; mine?: boolean }) {
  return useQuery({
    queryKey: ["kb-runs", params],
    queryFn: () => listRuns(params),
    enabled: !!params.articleId || !!params.mine,
  });
}

export function useKbVersions(articleId: string | undefined) {
  return useQuery({
    queryKey: ["kb-versions", articleId],
    queryFn: () => listVersions(articleId as string),
    enabled: !!articleId,
  });
}

export function useKbInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["kb-categories"] });
    qc.invalidateQueries({ queryKey: ["kb-articles"] });
    qc.invalidateQueries({ queryKey: ["kb-article"] });
    qc.invalidateQueries({ queryKey: ["kb-checklist"] });
    qc.invalidateQueries({ queryKey: ["kb-runs"] });
    qc.invalidateQueries({ queryKey: ["kb-versions"] });
  };
}
