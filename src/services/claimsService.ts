import { supabase } from "@/integrations/supabase/client";

export type ClaimStatus =
  | "open"
  | "awaiting_info"
  | "under_review"
  | "offer_made"
  | "settled"
  | "rejected"
  | "closed";

export type ClaimDamageType =
  | "visible"
  | "concealed"
  | "loss"
  | "missing_parts";

export const CLAIM_STATUSES: { value: ClaimStatus; label: string; tone: string }[] = [
  { value: "open", label: "Open", tone: "bg-blue-500 text-white" },
  { value: "awaiting_info", label: "Awaiting Info", tone: "bg-amber-500 text-white" },
  { value: "under_review", label: "Under Review", tone: "bg-purple-500 text-white" },
  { value: "offer_made", label: "Offer Made", tone: "bg-teal-500 text-white" },
  { value: "settled", label: "Settled", tone: "bg-green-600 text-white" },
  { value: "rejected", label: "Rejected", tone: "bg-red-500 text-white" },
  { value: "closed", label: "Closed", tone: "bg-gray-500 text-white" },
];

export const DAMAGE_TYPES: { value: ClaimDamageType; label: string }[] = [
  { value: "visible", label: "Visible Damage" },
  { value: "concealed", label: "Concealed Damage" },
  { value: "loss", label: "Loss / Non-Delivery" },
  { value: "missing_parts", label: "Missing Parts" },
];

export interface Claim {
  id: string;
  claim_ref: string | null;
  status: ClaimStatus;
  booking_ref: string;
  order_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  collection_date: string | null;
  delivery_date: string | null;
  route_name: string | null;
  driver_name: string | null;
  bike_make_model: string | null;
  declared_value: number | null;
  has_upgrades: boolean | null;
  upgrades_notes: string | null;
  damage_type: ClaimDamageType | null;
  damage_description: string | null;
  recorded_at_delivery: string | null;
  notification_date: string | null;
  within_timeframe: boolean | null;
  ev_booking_ref: boolean;
  ev_pre_collection_photos: boolean;
  ev_delivery_photos: boolean;
  ev_full_bike_photos: boolean;
  ev_proof_ownership: boolean;
  ev_proof_value: boolean;
  ev_upgrade_details: boolean;
  ev_repair_estimate: boolean;
  ev_delivery_note: boolean;
  claim_kind: string | null;
  assessor_appointed: boolean | null;
  assessor_name: string | null;
  repair_quote: number | null;
  market_value: number | null;
  betterment: boolean | null;
  betterment_amount: number | null;
  betterment_reason: string | null;
  recommended_settlement: number | null;
  settlement_override_reason: string | null;
  offer_amount: number | null;
  offer_date: string | null;
  offer_accepted: string | null;
  payment_reference: string | null;
  settlement_notes: string | null;
  title_transferred: boolean | null;
  internal_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClaimEvidenceFile {
  id: string;
  claim_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  label: string | null;
  kind: string;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface ClaimNote {
  id: string;
  claim_id: string;
  author_id: string | null;
  author_name: string | null;
  note: string;
  created_at: string;
}

export interface ClaimStatusLogEntry {
  id: string;
  claim_id: string;
  from_status: ClaimStatus | null;
  to_status: ClaimStatus;
  changed_by: string | null;
  changed_by_name: string | null;
  changed_at: string;
  note: string | null;
}

export const TIMEFRAME_DAYS: Record<ClaimDamageType, number> = {
  visible: 2,
  concealed: 5,
  loss: 5,
  missing_parts: 5,
};

export function isWithinTimeframe(
  damageType: ClaimDamageType | null,
  deliveryDate: string | null,
  notificationDate: string | null,
): boolean | null {
  if (!damageType || !deliveryDate || !notificationDate) return null;
  const limit = TIMEFRAME_DAYS[damageType];
  const d = new Date(deliveryDate).getTime();
  const n = new Date(notificationDate).getTime();
  if (Number.isNaN(d) || Number.isNaN(n)) return null;
  const diffDays = (n - d) / (1000 * 60 * 60 * 24);
  return diffDays <= limit;
}

export async function listClaims(filters: {
  status?: ClaimStatus | "all";
  search?: string;
} = {}): Promise<Claim[]> {
  let q = (supabase as any).from("claims").select("*").order("created_at", { ascending: false });
  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
  if (filters.search?.trim()) {
    const s = filters.search.trim();
    q = q.or(
      `booking_ref.ilike.%${s}%,customer_name.ilike.%${s}%,bike_make_model.ilike.%${s}%,claim_ref.ilike.%${s}%`,
    );
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Claim[];
}

export async function getClaim(id: string): Promise<Claim> {
  const { data, error } = await (supabase as any).from("claims").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Claim;
}

export async function createClaim(payload: Partial<Claim>): Promise<Claim> {
  const { data: userData } = await supabase.auth.getUser();
  const insertPayload: any = { ...payload, created_by: userData.user?.id };
  if (insertPayload.damage_type) {
    insertPayload.within_timeframe = isWithinTimeframe(
      insertPayload.damage_type,
      insertPayload.delivery_date ?? null,
      insertPayload.notification_date ?? null,
    );
  }
  const { data, error } = await (supabase as any).from("claims").insert(insertPayload).select("*").single();
  if (error) throw error;
  return data as Claim;
}

export async function updateClaim(id: string, patch: Partial<Claim>): Promise<Claim> {
  const next: any = { ...patch };
  if (next.damage_type !== undefined || next.notification_date !== undefined || next.delivery_date !== undefined) {
    // recompute when relevant fields change — fetch existing if needed
    const existing = await getClaim(id);
    next.within_timeframe = isWithinTimeframe(
      (next.damage_type ?? existing.damage_type) as ClaimDamageType | null,
      next.delivery_date ?? existing.delivery_date,
      next.notification_date ?? existing.notification_date,
    );
  }
  const { data, error } = await (supabase as any).from("claims").update(next).eq("id", id).select("*").single();
  if (error) throw error;
  return data as Claim;
}

export async function changeStatus(id: string, status: ClaimStatus, extra: Partial<Claim> = {}): Promise<Claim> {
  return updateClaim(id, { status, ...extra });
}

export async function addNote(claimId: string, note: string): Promise<ClaimNote> {
  const { data: userData } = await supabase.auth.getUser();
  let authorName: string | null = null;
  if (userData.user?.id) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("name,email")
      .eq("id", userData.user.id)
      .maybeSingle();
    authorName = prof?.name || prof?.email || null;
  }
  const { data, error } = await (supabase as any)
    .from("claim_notes")
    .insert({ claim_id: claimId, note, author_id: userData.user?.id, author_name: authorName })
    .select("*")
    .single();
  if (error) throw error;
  return data as ClaimNote;
}

export async function listNotes(claimId: string): Promise<ClaimNote[]> {
  const { data, error } = await (supabase as any)
    .from("claim_notes")
    .select("*")
    .eq("claim_id", claimId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ClaimNote[];
}

export async function getStatusLog(claimId: string): Promise<ClaimStatusLogEntry[]> {
  const { data, error } = await (supabase as any)
    .from("claim_status_log")
    .select("*")
    .eq("claim_id", claimId)
    .order("changed_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ClaimStatusLogEntry[];
}

export async function listEvidence(claimId: string): Promise<ClaimEvidenceFile[]> {
  const { data, error } = await (supabase as any)
    .from("claim_evidence_files")
    .select("*")
    .eq("claim_id", claimId)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ClaimEvidenceFile[];
}

export async function uploadEvidence(
  claimId: string,
  file: File,
  label: string,
  kind: "photo" | "document",
): Promise<ClaimEvidenceFile> {
  const { data: userData } = await supabase.auth.getUser();
  const ext = file.name.split(".").pop() || "bin";
  const path = `${claimId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage.from("claim-evidence").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) throw upErr;
  const { data, error } = await (supabase as any)
    .from("claim_evidence_files")
    .insert({
      claim_id: claimId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      label,
      kind,
      uploaded_by: userData.user?.id,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ClaimEvidenceFile;
}

export async function deleteEvidence(file: ClaimEvidenceFile): Promise<void> {
  await supabase.storage.from("claim-evidence").remove([file.storage_path]);
  const { error } = await (supabase as any).from("claim_evidence_files").delete().eq("id", file.id);
  if (error) throw error;
}

export async function getEvidenceSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("claim-evidence").createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

export interface ClaimsStats {
  open: number;
  awaitingInfo: number;
  settledThisMonthAmount: number;
  avgDaysToResolution: number;
}

export async function getClaimsStats(): Promise<ClaimsStats> {
  const { data, error } = await (supabase as any)
    .from("claims")
    .select("status,offer_amount,created_at,updated_at")
    .limit(5000);
  if (error) throw error;
  const rows = (data ?? []) as Array<Pick<Claim, "status" | "offer_amount" | "created_at" | "updated_at">>;
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  let open = 0;
  let awaitingInfo = 0;
  let settledThisMonth = 0;
  const resolutionDurations: number[] = [];
  for (const r of rows) {
    if (r.status === "open") open++;
    if (r.status === "awaiting_info") awaitingInfo++;
    if (r.status === "settled" && new Date(r.updated_at).getTime() >= startMonth) {
      settledThisMonth += Number(r.offer_amount ?? 0);
    }
    if (r.status === "settled" || r.status === "closed" || r.status === "rejected") {
      const days = (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) / 86400000;
      if (days >= 0) resolutionDurations.push(days);
    }
  }
  const avg = resolutionDurations.length
    ? resolutionDurations.reduce((a, b) => a + b, 0) / resolutionDurations.length
    : 0;
  return {
    open,
    awaitingInfo,
    settledThisMonthAmount: settledThisMonth,
    avgDaysToResolution: Math.round(avg * 10) / 10,
  };
}
