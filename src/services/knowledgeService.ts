import { supabase } from "@/integrations/supabase/client";
import type {
  KbArticle,
  KbArticleVersion,
  KbCategory,
  KbChecklistItem,
  KbChecklistRun,
} from "@/types/knowledge";

const db = () => supabase as any;

const ARTICLE_SELECT = `
  *,
  category:kb_categories(id, name, slug),
  author:profiles!kb_articles_created_by_fkey(id, name, email),
  editor:profiles!kb_articles_updated_by_fkey(id, name, email)
`;

// Profiles FKs may not exist on kb_articles, so fall back to plain select.
const ARTICLE_SELECT_BASIC = `*, category:kb_categories(id, name, slug)`;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export async function listCategories(): Promise<KbCategory[]> {
  const { data, error } = await db()
    .from("kb_categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as KbCategory[];
}

export async function createCategory(input: { name: string; description?: string }): Promise<KbCategory> {
  const { data, error } = await db()
    .from("kb_categories")
    .insert({
      name: input.name,
      slug: slugify(input.name) || `cat-${Date.now()}`,
      description: input.description ?? null,
      sort_order: 100,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as KbCategory;
}

export async function updateCategory(id: string, updates: Partial<KbCategory>): Promise<void> {
  const { error } = await db().from("kb_categories").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await db().from("kb_categories").delete().eq("id", id);
  if (error) throw error;
}

export async function listArticles(params: {
  categoryId?: string | null;
  search?: string;
  includeDrafts?: boolean;
} = {}): Promise<KbArticle[]> {
  let q = db().from("kb_articles").select(ARTICLE_SELECT_BASIC).limit(500);
  if (params.categoryId) q = q.eq("category_id", params.categoryId);
  if (!params.includeDrafts) q = q.eq("status", "published");
  const term = params.search?.trim();
  if (term) {
    const like = `%${term.replace(/[%,]/g, "")}%`;
    q = q.or(`title.ilike.${like},summary.ilike.${like},body.ilike.${like}`);
  }
  q = q.order("sort_order", { ascending: true }).order("title", { ascending: true });
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as KbArticle[];
}

export async function getArticle(idOrSlug: string): Promise<KbArticle | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
  const { data, error } = await db()
    .from("kb_articles")
    .select(ARTICLE_SELECT_BASIC)
    .eq(isUuid ? "id" : "slug", idOrSlug)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as KbArticle | null;
}

export async function createArticle(input: {
  title: string;
  category_id: string | null;
  summary?: string | null;
  body?: string;
  status?: string;
  tags?: string[];
}): Promise<KbArticle> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id ?? null;
  const base = slugify(input.title) || "sop";
  const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await db()
    .from("kb_articles")
    .insert({
      title: input.title,
      slug,
      category_id: input.category_id,
      summary: input.summary ?? null,
      body: input.body ?? "",
      status: input.status ?? "draft",
      tags: input.tags ?? [],
      created_by: uid,
      updated_by: uid,
    })
    .select(ARTICLE_SELECT_BASIC)
    .single();
  if (error) throw error;
  return data as KbArticle;
}

export async function updateArticle(id: string, updates: Partial<KbArticle>): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const payload: Record<string, unknown> = { ...updates, updated_by: auth?.user?.id ?? null };
  delete payload.category;
  delete payload.author;
  delete payload.editor;
  delete payload.checklist_count;
  const { error } = await db().from("kb_articles").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteArticle(id: string): Promise<void> {
  const { error } = await db().from("kb_articles").delete().eq("id", id);
  if (error) throw error;
}

export async function listVersions(articleId: string): Promise<KbArticleVersion[]> {
  const { data, error } = await db()
    .from("kb_article_versions")
    .select("*")
    .eq("article_id", articleId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as KbArticleVersion[];
}

export async function listChecklistItems(articleId: string): Promise<KbChecklistItem[]> {
  const { data, error } = await db()
    .from("kb_checklist_items")
    .select("*")
    .eq("article_id", articleId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as KbChecklistItem[];
}

export async function saveChecklistItems(
  articleId: string,
  items: { id?: string; text: string; guidance?: string | null }[]
): Promise<void> {
  const existing = await listChecklistItems(articleId);
  const keptIds = new Set(items.map((i) => i.id).filter(Boolean) as string[]);
  const toDelete = existing.filter((e) => !keptIds.has(e.id)).map((e) => e.id);
  if (toDelete.length) {
    const { error } = await db().from("kb_checklist_items").delete().in("id", toDelete);
    if (error) throw error;
  }
  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    if (!it.text.trim()) continue;
    if (it.id) {
      const { error } = await db()
        .from("kb_checklist_items")
        .update({ text: it.text, guidance: it.guidance ?? null, position: idx })
        .eq("id", it.id);
      if (error) throw error;
    } else {
      const { error } = await db()
        .from("kb_checklist_items")
        .insert({ article_id: articleId, text: it.text, guidance: it.guidance ?? null, position: idx });
      if (error) throw error;
    }
  }
}

export async function listRuns(params: { articleId?: string; mine?: boolean } = {}): Promise<KbChecklistRun[]> {
  let q = db()
    .from("kb_checklist_runs")
    .select("*, items:kb_checklist_run_items(*)")
    .order("started_at", { ascending: false })
    .limit(100);
  if (params.articleId) q = q.eq("article_id", params.articleId);
  if (params.mine) {
    const { data: auth } = await supabase.auth.getUser();
    if (auth?.user?.id) q = q.eq("user_id", auth.user.id);
  }
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as KbChecklistRun[]).map((r) => ({
    ...r,
    items: (r.items ?? []).slice().sort((a, b) => a.position - b.position),
  }));
}

export async function startRun(articleId: string, label?: string): Promise<KbChecklistRun> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error("Not signed in");
  const items = await listChecklistItems(articleId);
  const { data: run, error } = await db()
    .from("kb_checklist_runs")
    .insert({ article_id: articleId, user_id: uid, label: label ?? null })
    .select("*")
    .single();
  if (error) throw error;
  if (items.length) {
    const rows = items.map((i, idx) => ({
      run_id: run.id,
      item_id: i.id,
      position: idx,
      text: i.text,
    }));
    const { error: itemsError } = await db().from("kb_checklist_run_items").insert(rows);
    if (itemsError) throw itemsError;
  }
  return { ...(run as KbChecklistRun), items: [] };
}

export async function toggleRunItem(itemId: string, done: boolean, note?: string | null): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await db()
    .from("kb_checklist_run_items")
    .update({
      done,
      note: note === undefined ? undefined : note,
      completed_by: done ? auth?.user?.id ?? null : null,
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq("id", itemId);
  if (error) throw error;
}

export async function updateRunItemNote(itemId: string, note: string): Promise<void> {
  const { error } = await db().from("kb_checklist_run_items").update({ note }).eq("id", itemId);
  if (error) throw error;
}

export async function finishRun(runId: string, notes?: string | null): Promise<void> {
  const { error } = await db()
    .from("kb_checklist_runs")
    .update({ completed_at: new Date().toISOString(), notes: notes ?? null })
    .eq("id", runId);
  if (error) throw error;
}

export async function deleteRun(runId: string): Promise<void> {
  const { error } = await db().from("kb_checklist_runs").delete().eq("id", runId);
  if (error) throw error;
}

export { ARTICLE_SELECT };
