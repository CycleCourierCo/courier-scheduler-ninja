import { supabase } from "@/integrations/supabase/client";

export type ClaimStatus =
  // New step-by-step workflow
  | "opened"
  | "info_requested"
  | "info_provided"
  | "assessment"
  | "settlement_proposed"
  | "negotiation"
  | "settlement_agreed"
  | "closed"
  | "rejected"
  // Legacy values (still valid; mapped to nearest new step in UI)
  | "open"
  | "awaiting_info"
  | "under_review"
  | "offer_made"
  | "settled";

export type ClaimDamageType =
  | "visible"
  | "concealed"
  | "loss"
  | "missing_parts";

export const CLAIM_STATUSES: { value: ClaimStatus; label: string; tone: string }[] = [
  { value: "opened", label: "Opened", tone: "bg-blue-500 text-white" },
  { value: "info_requested", label: "Information Requested", tone: "bg-amber-500 text-white" },
  { value: "info_provided", label: "Information Provided", tone: "bg-amber-600 text-white" },
  { value: "assessment", label: "Assessment", tone: "bg-purple-500 text-white" },
  { value: "settlement_proposed", label: "Settlement Proposed", tone: "bg-teal-500 text-white" },
  { value: "negotiation", label: "Negotiation", tone: "bg-orange-500 text-white" },
  { value: "settlement_agreed", label: "Settlement Agreed", tone: "bg-green-500 text-white" },
  { value: "closed", label: "Closed", tone: "bg-gray-600 text-white" },
  { value: "rejected", label: "Rejected", tone: "bg-red-500 text-white" },
  // Legacy
  { value: "open", label: "Opened", tone: "bg-blue-500 text-white" },
  { value: "awaiting_info", label: "Information Requested", tone: "bg-amber-500 text-white" },
  { value: "under_review", label: "Assessment", tone: "bg-purple-500 text-white" },
  { value: "offer_made", label: "Settlement Proposed", tone: "bg-teal-500 text-white" },
  { value: "settled", label: "Settlement Agreed", tone: "bg-green-500 text-white" },
];

/** Linear workflow steps shown in the stepper. */
export const CLAIM_STEPS: { value: ClaimStatus; label: string }[] = [
  { value: "opened", label: "Opened" },
  { value: "info_requested", label: "Info Requested" },
  { value: "info_provided", label: "Info Provided" },
  { value: "assessment", label: "Assessment" },
  { value: "settlement_proposed", label: "Settlement Proposed" },
  { value: "negotiation", label: "Negotiation" },
  { value: "settlement_agreed", label: "Settlement Agreed" },
  { value: "closed", label: "Closed" },
];

/** Map any (legacy or new) status to the canonical step value. */
export function canonicalStep(status: ClaimStatus): ClaimStatus {
  switch (status) {
    case "open": return "opened";
    case "awaiting_info": return "info_requested";
    case "under_review": return "assessment";
    case "offer_made": return "settlement_proposed";
    case "settled": return "settlement_agreed";
    default: return status;
  }
}

export function stepIndex(status: ClaimStatus): number {
  const c = canonicalStep(status);
  return CLAIM_STEPS.findIndex((s) => s.value === c);
}

/** Returns the next step in the linear flow, or null if terminal. */
export function nextStep(status: ClaimStatus): ClaimStatus | null {
  if (status === "rejected" || status === "closed") return null;
  const idx = stepIndex(status);
  if (idx < 0 || idx >= CLAIM_STEPS.length - 1) return null;
  return CLAIM_STEPS[idx + 1].value;
}

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
  order_id: string;
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
  is_system?: boolean;
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

/** Slim shape of an order used in claim displays/lookups. */
export interface ClaimOrder {
  id: string;
  tracking_number: string | null;
  status: string | null;
  sender: any;
  receiver: any;
  bikes: any;
  bike_brand: string | null;
  bike_model: string | null;
  bike_value: number | null;
  scheduled_pickup_date: string | null;
  scheduled_delivery_date: string | null;
  collection_driver_name: string | null;
  delivery_driver_name: string | null;
  customer_order_number: string | null;
  created_at: string;
}

export interface DerivedClaimFields {
  bookingRef: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  collectionDate: string | null;
  deliveryDate: string | null;
  collectionDriverName: string | null;
  deliveryDriverName: string | null;
  bikeMakeModel: string | null;
  declaredValue: number | null;
  senderPostcode: string | null;
  receiverPostcode: string | null;
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

const datePart = (v: string | null | undefined): string | null => {
  if (!v) return null;
  return String(v).slice(0, 10);
};

export function deriveClaimFields(claim: Claim, order: ClaimOrder | null): DerivedClaimFields {
  const recv = order?.receiver ?? {};
  const send = order?.sender ?? {};
  const bikes = Array.isArray(order?.bikes) ? order!.bikes : [];
  const firstBike = bikes[0] ?? {};
  const brand = firstBike.brand ?? order?.bike_brand ?? null;
  const model = firstBike.model ?? order?.bike_model ?? null;
  const bikeMakeModel = [brand, model].filter(Boolean).join(" ").trim() || null;
  return {
    bookingRef: order?.tracking_number ?? claim.booking_ref,
    customerName: recv.name ?? send.name ?? null,
    customerEmail: recv.email ?? send.email ?? null,
    customerPhone: recv.phone ?? send.phone ?? null,
    collectionDate: datePart(order?.scheduled_pickup_date ?? null),
    deliveryDate: datePart(order?.scheduled_delivery_date ?? null),
    collectionDriverName: order?.collection_driver_name ?? null,
    deliveryDriverName: order?.delivery_driver_name ?? null,
    bikeMakeModel,
    declaredValue: order?.bike_value ?? null,
    senderPostcode: send.postal_code ?? send.postalCode ?? null,
    receiverPostcode: recv.postal_code ?? recv.postalCode ?? null,
  };
}

const ORDER_FIELDS =
  "id,tracking_number,status,sender,receiver,bikes,bike_brand,bike_model,bike_value,scheduled_pickup_date,scheduled_delivery_date,collection_driver_name,delivery_driver_name,customer_order_number,created_at";

export async function searchOrdersForClaim(query: string): Promise<ClaimOrder[]> {
  let q = supabase.from("orders").select(ORDER_FIELDS).order("created_at", { ascending: false }).limit(20);
  const s = query.trim();
  if (s) {
    const safe = s.replace(/[,()]/g, " ");
    q = q.or(
      `tracking_number.ilike.%${safe}%,receiver->>name.ilike.%${safe}%,receiver->>email.ilike.%${safe}%,sender->>name.ilike.%${safe}%`,
    );
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ClaimOrder[];
}

export async function getOrder(orderId: string): Promise<ClaimOrder | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_FIELDS)
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ClaimOrder) ?? null;
}

export async function getOrdersByIds(ids: string[]): Promise<Record<string, ClaimOrder>> {
  if (!ids.length) return {};
  const { data, error } = await supabase.from("orders").select(ORDER_FIELDS).in("id", ids);
  if (error) throw error;
  const map: Record<string, ClaimOrder> = {};
  for (const row of (data ?? []) as unknown as ClaimOrder[]) map[row.id] = row;
  return map;
}

export async function listClaims(filters: {
  status?: ClaimStatus | "all";
  search?: string;
} = {}): Promise<{ claim: Claim; order: ClaimOrder | null; derived: DerivedClaimFields }[]> {
  let q = (supabase as any).from("claims").select("*").order("created_at", { ascending: false });
  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
  if (filters.search?.trim()) {
    const s = filters.search.trim().replace(/[,()]/g, " ");
    q = q.or(`booking_ref.ilike.%${s}%,claim_ref.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  const claims = (data ?? []) as Claim[];
  const orderIds = Array.from(new Set(claims.map((c) => c.order_id).filter(Boolean))) as string[];
  const orderMap = await getOrdersByIds(orderIds);
  return claims.map((c) => {
    const order = orderMap[c.order_id] ?? null;
    return { claim: c, order, derived: deriveClaimFields(c, order) };
  });
}

export async function getClaim(id: string): Promise<{ claim: Claim; order: ClaimOrder | null }> {
  const { data, error } = await (supabase as any).from("claims").select("*").eq("id", id).single();
  if (error) throw error;
  const claim = data as Claim;
  const order = claim.order_id ? await getOrder(claim.order_id) : null;
  return { claim, order };
}

export async function createClaim(payload: {
  order_id: string;
  booking_ref: string;
  damage_type?: ClaimDamageType | null;
  damage_description?: string | null;
  recorded_at_delivery?: string | null;
  notification_date?: string | null;
  internal_notes?: string | null;
  ev_booking_ref?: boolean;
  ev_pre_collection_photos?: boolean;
  ev_delivery_photos?: boolean;
  ev_full_bike_photos?: boolean;
  ev_proof_ownership?: boolean;
  ev_proof_value?: boolean;
  ev_upgrade_details?: boolean;
  ev_repair_estimate?: boolean;
  ev_delivery_note?: boolean;
  status?: ClaimStatus;
}): Promise<Claim> {
  const { data: userData } = await supabase.auth.getUser();
  // For timeframe calc we need delivery date — fetch order
  let withinTimeframe: boolean | null = null;
  if (payload.damage_type && payload.notification_date) {
    const order = await getOrder(payload.order_id);
    const deliveryDate = datePart(order?.scheduled_delivery_date ?? null);
    withinTimeframe = isWithinTimeframe(payload.damage_type, deliveryDate, payload.notification_date);
  }
  const insertPayload: any = {
    ...payload,
    created_by: userData.user?.id,
    within_timeframe: withinTimeframe,
    status: payload.status ?? "open",
  };
  const { data, error } = await (supabase as any).from("claims").insert(insertPayload).select("*").single();
  if (error) throw error;
  return data as Claim;
}

export async function updateClaim(id: string, patch: Partial<Claim>): Promise<Claim> {
  const next: any = { ...patch };
  if (next.damage_type !== undefined || next.notification_date !== undefined) {
    const { claim, order } = await getClaim(id);
    const deliveryDate = datePart(order?.scheduled_delivery_date ?? null);
    next.within_timeframe = isWithinTimeframe(
      (next.damage_type ?? claim.damage_type) as ClaimDamageType | null,
      deliveryDate,
      next.notification_date ?? claim.notification_date,
    );
  }
  const { data, error } = await (supabase as any).from("claims").update(next).eq("id", id).select("*").single();
  if (error) throw error;
  return data as Claim;
}

export async function changeStatus(id: string, status: ClaimStatus, extra: Partial<Claim> = {}): Promise<Claim> {
  return updateClaim(id, { status, ...extra });
}

async function getCurrentAuthor(): Promise<{ id: string | null; name: string | null }> {
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
  return { id: userData.user?.id ?? null, name: authorName };
}

export async function addNote(
  claimId: string,
  note: string,
  opts: { isSystem?: boolean } = {},
): Promise<ClaimNote> {
  const author = await getCurrentAuthor();
  const { data, error } = await (supabase as any)
    .from("claim_notes")
    .insert({
      claim_id: claimId,
      note,
      author_id: author.id,
      author_name: opts.isSystem ? "System" : author.name,
      is_system: !!opts.isSystem,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ClaimNote;
}

const fmtMoneyLabel = (v: number | null | undefined) =>
  v == null ? "—" : `£${Number(v).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STEP_LABEL: Record<string, string> =
  Object.fromEntries(CLAIM_STATUSES.map((s) => [s.value, s.label]));

/**
 * Advance the claim to the next step in the linear workflow.
 * Validates required data and writes a system note describing the transition.
 */
export async function advanceClaim(
  id: string,
  extra: Partial<Claim> = {},
): Promise<Claim> {
  const { claim } = await getClaim(id);
  const next = nextStep(claim.status);
  if (!next) throw new Error("Claim is already at the final step.");

  // Per-step validation
  if (next === "settlement_proposed") {
    const amount = (extra.offer_amount ?? claim.offer_amount) as number | null | undefined;
    if (amount == null || Number.isNaN(Number(amount))) {
      throw new Error("Settlement amount is required to propose a settlement.");
    }
  }
  if (next === "settlement_agreed") {
    if ((extra.offer_accepted ?? claim.offer_accepted) !== "yes") {
      extra = { ...extra, offer_accepted: "yes" };
    }
  }
  if (next === "closed") {
    // No hard requirement, but ok
  }

  const updated = await updateClaim(id, { status: next, ...extra });
  const author = await getCurrentAuthor();
  const who = author.name ? ` by ${author.name}` : "";
  const when = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  let msg = `Advanced to "${STEP_LABEL[next] ?? next}"${who} on ${when}.`;
  if (next === "settlement_proposed") {
    msg = `Settlement of ${fmtMoneyLabel(updated.offer_amount)} proposed${who} on ${when}.`;
  } else if (next === "settlement_agreed") {
    msg = `Settlement of ${fmtMoneyLabel(updated.offer_amount)} agreed${who} on ${when}.`;
  } else if (next === "closed") {
    msg = `Claim closed${who} on ${when}.`;
  } else if (next === "info_requested") {
    msg = `Information requested from customer${who} on ${when}.`;
  } else if (next === "info_provided") {
    msg = `Customer information received${who} on ${when}.`;
  } else if (next === "assessment") {
    msg = `Assessment started${who} on ${when}.`;
  } else if (next === "negotiation") {
    msg = `Settlement entered negotiation${who} on ${when}.`;
  }
  await addNote(id, msg, { isSystem: true });
  return updated;
}

export async function rejectClaim(id: string, reason?: string): Promise<Claim> {
  const updated = await updateClaim(id, { status: "rejected" });
  const author = await getCurrentAuthor();
  const who = author.name ? ` by ${author.name}` : "";
  const when = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  await addNote(id, `Claim rejected${who} on ${when}${reason ? `: ${reason}` : "."}`, { isSystem: true });
  return updated;
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
