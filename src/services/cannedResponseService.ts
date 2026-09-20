import { supabase } from "@/integrations/supabase/client";

const db = () => supabase as any;

export interface CsCannedResponse {
  id: string;
  title: string;
  category: string;
  body: string;
  keywords: string[];
  is_active: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function listCannedResponses(includeInactive = false): Promise<CsCannedResponse[]> {
  let q = db().from("cs_canned_responses").select("*");
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CsCannedResponse[];
}

export async function createCannedResponse(input: {
  title: string;
  category?: string;
  body: string;
  keywords?: string[];
  sort_order?: number;
}): Promise<CsCannedResponse> {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await db()
    .from("cs_canned_responses")
    .insert({
      title: input.title,
      category: input.category?.trim() || "General",
      body: input.body,
      keywords: input.keywords ?? [],
      sort_order: input.sort_order ?? 100,
      created_by: auth?.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CsCannedResponse;
}

export async function updateCannedResponse(
  id: string,
  updates: Partial<Pick<CsCannedResponse, "title" | "category" | "body" | "keywords" | "is_active" | "sort_order">>,
): Promise<void> {
  const { error } = await db().from("cs_canned_responses").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteCannedResponse(id: string): Promise<void> {
  const { error } = await db().from("cs_canned_responses").delete().eq("id", id);
  if (error) throw error;
}
