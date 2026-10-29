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
  auto_send_mode?: "off" | "trial" | "live";
  blocked_from_auto?: boolean;
  auto_disabled_at?: string | null;
  auto_disabled_reason?: string | null;
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

// ---- Confidence scoring & auto-send ----
export type AutoSendMode = "off" | "trial" | "live";
export type CannedOutcome = "as_is" | "edited" | "rewritten" | "replaced";

export interface CsCannedStats {
  response_id: string; uses: number; window_uses: number; confidence: number | null;
  as_is: number; edited: number; rewritten: number; replaced: number; auto_sent: number;
  flagged_wrong: number; trial_total: number; trial_agreed: number; trial_reviewed: number;
}

export async function listCannedStats(): Promise<Record<string, CsCannedStats>> {
  const { data, error } = await db().from("cs_canned_stats").select("*");
  if (error) throw error;
  const out: Record<string, CsCannedStats> = {};
  for (const r of data ?? []) out[r.response_id] = { ...r, confidence: r.confidence == null ? null : Number(r.confidence) };
  return out;
}

export async function recordCannedOutcome(input: {
  responseId: string; conversationId: string; inboundMessageId?: string | null;
  matchScore: number; runnerUpScore: number; outcome: CannedOutcome; similarity?: number | null; staffId: string;
}): Promise<void> {
  const { error } = await db().from("cs_canned_usage").insert({
    response_id: input.responseId, conversation_id: input.conversationId,
    inbound_message_id: input.inboundMessageId ?? null, match_score: input.matchScore,
    runner_up_score: input.runnerUpScore, outcome: input.outcome,
    similarity: input.similarity ?? null, staff_id: input.staffId,
  });
  if (error) throw error;
  // If this outcome switched an auto-send response off, the server emails admins (once).
  supabase.functions.invoke("cs-canned-flag", { body: { action: "check", response_id: input.responseId } }).catch(() => {});
}

export async function setAutoSendMode(id: string, mode: AutoSendMode): Promise<void> {
  const { error } = await db().from("cs_canned_responses").update({ auto_send_mode: mode }).eq("id", id);
  if (error) throw error;
}

export async function setBlockedFromAuto(id: string, blocked: boolean): Promise<void> {
  const updates: any = { blocked_from_auto: blocked };
  if (blocked) updates.auto_send_mode = "off";
  const { error } = await db().from("cs_canned_responses").update(updates).eq("id", id);
  if (error) throw error;
}

export async function flagWrongAutoReply(messageId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("cs-canned-flag", { body: { action: "flag", message_id: messageId } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function listRejectedUses(responseId: string, limit = 10) {
  const { data, error } = await db().from("cs_canned_usage")
    .select("id, outcome, similarity, created_at, flagged_wrong, conversation_id, inbound:cs_messages!cs_canned_usage_inbound_message_id_fkey(body_text), conv:cs_conversations(ticket_ref)")
    .eq("response_id", responseId).or("outcome.in.(rewritten,replaced),flagged_wrong.eq.true")
    .order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data ?? [];
}
