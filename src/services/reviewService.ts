import { supabase } from "@/integrations/supabase/client";
import type { UserRole } from "@/types/user";
import {
  PERFORMANCE_WEIGHT,
  BEHAVIOUR_WEIGHT,
} from "@/config/reviewCompetencies";
import type {
  ReviewAction,
  ReviewActionOwner,
  ReviewActionStatus,
  ReviewAgreement,
  ReviewBundle,
  ReviewCycle,
  ReviewFilters,
  ReviewRating,
  ReviewResponse,
  ReviewSource,
  ReviewStage,
  ReviewType,
} from "@/types/review";

const db = () => supabase as any;

const CYCLE_SELECT = `
  *,
  employee:profiles!review_cycles_employee_id_fkey(id, name, email),
  reviewer:profiles!review_cycles_reviewer_id_fkey(id, name, email)
`;

export interface InternalUserOption {
  id: string;
  name: string | null;
  email: string | null;
}

export async function listReviewableUsers(): Promise<InternalUserOption[]> {
  const { data, error } = await db().rpc("list_internal_users");
  if (error) throw error;
  return ((data ?? []) as InternalUserOption[]).sort((a, b) =>
    (a.name || a.email || "").localeCompare(b.name || b.email || "")
  );
}

export async function getEmployeeRoles(userId: string): Promise<UserRole[]> {
  const { data, error } = await db().from("user_roles").select("role").eq("user_id", userId);
  if (error) throw error;
  return ((data ?? []) as { role: UserRole }[]).map(r => r.role);
}

export async function listReviewCycles(filters: ReviewFilters = {}): Promise<ReviewCycle[]> {
  let q = db()
    .from("review_cycles")
    .select(CYCLE_SELECT)
    .order("period_end", { ascending: false })
    .limit(500);

  if (filters.employeeId && filters.employeeId !== "all") q = q.eq("employee_id", filters.employeeId);
  if (filters.reviewType && filters.reviewType !== "all") q = q.eq("review_type", filters.reviewType);
  if (filters.stage && filters.stage !== "all") {
    if (filters.stage === "active") q = q.neq("stage", "signed_off");
    else q = q.eq("stage", filters.stage);
  }
  if (filters.from) q = q.gte("period_end", filters.from);
  if (filters.to) q = q.lte("period_start", filters.to);

  const { data, error } = await q;
  if (error) throw error;

  let rows = (data ?? []) as ReviewCycle[];
  if (filters.search) {
    const s = filters.search.toLowerCase();
    rows = rows.filter(r =>
      (r.employee?.name || "").toLowerCase().includes(s) ||
      (r.employee?.email || "").toLowerCase().includes(s)
    );
  }
  return rows;
}

export async function listMyReviewCycles(userId: string): Promise<ReviewCycle[]> {
  const { data, error } = await db()
    .from("review_cycles")
    .select(CYCLE_SELECT)
    .eq("employee_id", userId)
    .order("period_end", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ReviewCycle[];
}

export async function getReviewBundle(cycleId: string): Promise<ReviewBundle> {
  const [cycleRes, ratingsRes, responsesRes, actionsRes] = await Promise.all([
    db().from("review_cycles").select(CYCLE_SELECT).eq("id", cycleId).single(),
    db().from("review_ratings").select("*").eq("cycle_id", cycleId),
    db().from("review_responses").select("*").eq("cycle_id", cycleId),
    db().from("review_actions").select("*").eq("cycle_id", cycleId).order("created_at"),
  ]);
  if (cycleRes.error) throw cycleRes.error;
  if (ratingsRes.error) throw ratingsRes.error;
  if (responsesRes.error) throw responsesRes.error;
  if (actionsRes.error) throw actionsRes.error;

  return {
    cycle: cycleRes.data as ReviewCycle,
    ratings: (ratingsRes.data ?? []) as ReviewRating[],
    responses: (responsesRes.data ?? []) as ReviewResponse[],
    actions: (actionsRes.data ?? []) as ReviewAction[],
  };
}

export interface CreateReviewInput {
  employee_id: string;
  reviewer_id?: string | null;
  review_type: ReviewType;
  period_start: string;
  period_end: string;
  review_date?: string | null;
}

export async function createReviewCycle(input: CreateReviewInput): Promise<ReviewCycle> {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await db()
    .from("review_cycles")
    .insert({ ...input, created_by: auth?.user?.id ?? null })
    .select(CYCLE_SELECT)
    .single();
  if (error) throw error;
  return data as ReviewCycle;
}

export async function updateReviewCycle(
  cycleId: string,
  updates: Partial<Pick<ReviewCycle,
    "reviewer_id" | "review_type" | "period_start" | "period_end" | "review_date" | "meeting_notes" | "stage">>
): Promise<void> {
  const { error } = await db().from("review_cycles").update(updates).eq("id", cycleId);
  if (error) throw error;
}

export async function deleteReviewCycle(cycleId: string): Promise<void> {
  const { error } = await db().from("review_cycles").delete().eq("id", cycleId);
  if (error) throw error;
}

/** Upsert a single rating row (score and/or comment) */
export async function saveRating(params: {
  cycleId: string;
  competencyKey: string;
  category: "performance" | "behaviour";
  source: ReviewSource;
  score: number | null;
  comment: string | null;
}): Promise<void> {
  const { error } = await db()
    .from("review_ratings")
    .upsert(
      {
        cycle_id: params.cycleId,
        competency_key: params.competencyKey,
        category: params.category,
        source: params.source,
        score: params.score,
        comment: params.comment,
      },
      { onConflict: "cycle_id,competency_key,source" }
    );
  if (error) throw error;
}

export async function saveResponse(params: {
  cycleId: string;
  questionKey: string;
  source: ReviewSource;
  answer: string | null;
}): Promise<void> {
  const { error } = await db()
    .from("review_responses")
    .upsert(
      {
        cycle_id: params.cycleId,
        question_key: params.questionKey,
        source: params.source,
        answer: params.answer,
      },
      { onConflict: "cycle_id,question_key,source" }
    );
  if (error) throw error;
}

export async function addAction(cycleId: string, action: {
  description: string;
  owner: ReviewActionOwner;
  due_date?: string | null;
}): Promise<void> {
  const { error } = await db().from("review_actions").insert({ cycle_id: cycleId, ...action });
  if (error) throw error;
}

export async function updateAction(id: string, updates: Partial<{
  description: string;
  owner: ReviewActionOwner;
  due_date: string | null;
  status: ReviewActionStatus;
}>): Promise<void> {
  const payload: Record<string, unknown> = { ...updates };
  if (updates.status) payload.completed_at = updates.status === "complete" ? new Date().toISOString() : null;
  const { error } = await db().from("review_actions").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteAction(id: string): Promise<void> {
  const { error } = await db().from("review_actions").delete().eq("id", id);
  if (error) throw error;
}

const avg = (values: number[]): number | null => {
  if (!values.length) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
};

/** Recompute scores from the stored ratings — never trusted from the client */
export async function recomputeScores(cycleId: string): Promise<void> {
  const { data, error } = await db()
    .from("review_ratings")
    .select("category, source, score")
    .eq("cycle_id", cycleId);
  if (error) throw error;

  const rows = (data ?? []) as { category: string; source: string; score: number | null }[];
  const scored = rows.filter(r => typeof r.score === "number");

  const perf = avg(scored.filter(r => r.source === "manager" && r.category === "performance").map(r => r.score as number));
  const behav = avg(scored.filter(r => r.source === "manager" && r.category === "behaviour").map(r => r.score as number));
  const selfAll = avg(scored.filter(r => r.source === "self").map(r => r.score as number));

  let overall: number | null = null;
  if (perf !== null && behav !== null) {
    overall = Math.round((perf * PERFORMANCE_WEIGHT + behav * BEHAVIOUR_WEIGHT) * 100) / 100;
  } else {
    overall = perf ?? behav;
  }

  const { error: upErr } = await db()
    .from("review_cycles")
    .update({
      performance_score: perf,
      behaviour_score: behav,
      overall_score: overall,
      self_overall_score: selfAll,
    })
    .eq("id", cycleId);
  if (upErr) throw upErr;
}

export async function advanceStage(cycleId: string, stage: ReviewStage): Promise<void> {
  const updates: Record<string, unknown> = { stage };
  if (stage === "manager_assessment") updates.self_submitted_at = new Date().toISOString();
  if (stage === "review_meeting") updates.manager_submitted_at = new Date().toISOString();
  if (stage === "signed_off") {
    const { data: auth } = await supabase.auth.getUser();
    updates.signed_off_at = new Date().toISOString();
    updates.signed_off_by = auth?.user?.id ?? null;
  }
  await recomputeScores(cycleId);
  const { error } = await db().from("review_cycles").update(updates).eq("id", cycleId);
  if (error) throw error;
}

export async function reopenReview(cycleId: string, stage: ReviewStage = "manager_assessment"): Promise<void> {
  const { error } = await db()
    .from("review_cycles")
    .update({ stage, signed_off_at: null, signed_off_by: null })
    .eq("id", cycleId);
  if (error) throw error;
}

export async function submitEmployeeResponse(cycleId: string, payload: {
  employee_agreement: ReviewAgreement;
  employee_comments: string | null;
  employee_requests_discussion: boolean;
}): Promise<void> {
  const { error } = await db()
    .from("review_cycles")
    .update({ ...payload, employee_acknowledged_at: new Date().toISOString() })
    .eq("id", cycleId);
  if (error) throw error;
}

export interface ReviewHistoryPoint {
  id: string;
  label: string;
  period_end: string;
  overall: number | null;
  self: number | null;
  performance: number | null;
  behaviour: number | null;
}

/** Historical trend for an employee (oldest first) */
export async function getEmployeeHistory(employeeId: string): Promise<ReviewHistoryPoint[]> {
  const { data, error } = await db()
    .from("review_cycles")
    .select("id, review_type, period_start, period_end, overall_score, self_overall_score, performance_score, behaviour_score")
    .eq("employee_id", employeeId)
    .order("period_end", { ascending: true });
  if (error) throw error;

  return ((data ?? []) as any[]).map(r => ({
    id: r.id,
    label: new Date(r.period_end).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
    period_end: r.period_end,
    overall: r.overall_score !== null ? Number(r.overall_score) : null,
    self: r.self_overall_score !== null ? Number(r.self_overall_score) : null,
    performance: r.performance_score !== null ? Number(r.performance_score) : null,
    behaviour: r.behaviour_score !== null ? Number(r.behaviour_score) : null,
  }));
}

/** The most recent signed-off / previous review before this one, for the recap panel */
export async function getPreviousReview(employeeId: string, beforePeriodStart: string): Promise<ReviewBundle | null> {
  const { data, error } = await db()
    .from("review_cycles")
    .select("id")
    .eq("employee_id", employeeId)
    .lt("period_start", beforePeriodStart)
    .order("period_start", { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = (data ?? [])[0];
  if (!row) return null;
  return getReviewBundle(row.id);
}
