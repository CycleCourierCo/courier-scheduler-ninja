import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export interface InspectionTemplate {
  id: string; inspection_type: string; name: string; description: string | null;
  requires_competent_inspector: boolean; active: boolean;
}
export interface TemplateItem { id: string; template_id: string; category: string; label: string; is_tyre: boolean; sort_order: number; active: boolean }
export interface Inspection {
  id: string; vehicle_id: string; template_id: string | null; inspection_type: string; status: "draft" | "final";
  inspected_at: string; inspector_name: string | null; inspector_organisation: string | null; odometer_mi: number | null;
  notes: string | null; overall_result: string | null; supersedes_id: string | null; correction_reason: string | null;
  finalised_at: string | null; created_at: string;
}
export interface InspectionResult {
  id: string; inspection_id: string; category: string; label: string; is_tyre: boolean; sort_order: number;
  result: string; reason: string | null; tread_fl: number | null; tread_fr: number | null; tread_rl: number | null; tread_rr: number | null;
  defect_id: string | null;
}
export interface Defect {
  id: string; vehicle_id: string; title: string; description: string | null; severity: "low" | "medium" | "high"; status: string;
  category: string | null; assigned_to: string | null; inspection_id: string | null; rectification_evidence: string | null;
  verified_by_name: string | null; verified_at: string | null; attachments: { path: string; name: string }[];
  resolution_note: string | null; resolved_at: string | null; created_at: string;
  is_breakdown?: boolean; breakdown_at?: string | null; breakdown_location?: string | null; breakdown_driver?: string | null;
  breakdown_route?: string | null; recovery_provider?: string | null; recovery_cost?: number | null;
}

const must = <T,>({ data, error }: { data: T; error: any }) => { if (error) throw new Error(error.message); return data; };

export const listTemplates = async (): Promise<InspectionTemplate[]> =>
  must(await db.from("fleet_inspection_templates").select("*").order("name"));

export const listTemplateItems = async (templateId: string): Promise<TemplateItem[]> =>
  must(await db.from("fleet_inspection_template_items").select("*").eq("template_id", templateId).order("sort_order"));

export const listInspections = async (vehicleId: string): Promise<Inspection[]> =>
  must(await db.from("fleet_inspections").select("*").eq("vehicle_id", vehicleId).order("inspected_at", { ascending: false }));

export const getInspection = async (id: string) => {
  const insp: Inspection = must(await db.from("fleet_inspections").select("*").eq("id", id).single());
  const results: InspectionResult[] = must(await db.from("fleet_inspection_results").select("*").eq("inspection_id", id).order("sort_order"));
  return { insp, results };
};

export async function startInspection(vehicleId: string, template: InspectionTemplate, odometer?: number) {
  const items = (await listTemplateItems(template.id)).filter((i) => i.active);
  const insp: Inspection = must(await db.from("fleet_inspections").insert({
    vehicle_id: vehicleId, template_id: template.id, inspection_type: template.inspection_type, odometer_mi: odometer ?? null,
  }).select().single());
  if (items.length) must(await db.from("fleet_inspection_results").insert(items.map((i) => ({
    inspection_id: insp.id, template_item_id: i.id, category: i.category, label: i.label, is_tyre: i.is_tyre, sort_order: i.sort_order,
  }))));
  return insp;
}

/** Corrections never edit the locked original: they copy it into a new linked draft. */
export async function createCorrection(original: Inspection, results: InspectionResult[], reason: string) {
  const { id: _i, status: _s, finalised_at: _f, created_at: _c, overall_result: _o, ...rest } = original;
  const insp: Inspection = must(await db.from("fleet_inspections").insert({
    ...rest, supersedes_id: original.id, correction_reason: reason, inspected_at: new Date().toISOString(),
  }).select().single());
  if (results.length) must(await db.from("fleet_inspection_results").insert(results.map(({ id: _x, inspection_id: _y, ...r }) => ({ ...r, inspection_id: insp.id }))));
  return insp;
}

export const saveResult = async (id: string, patch: Partial<InspectionResult>) =>
  must(await db.from("fleet_inspection_results").update(patch).eq("id", id));

export const updateInspection = async (id: string, patch: Partial<Inspection>) =>
  must(await db.from("fleet_inspections").update(patch).eq("id", id));

export async function defectFromResult(insp: Inspection, r: InspectionResult, severity: Defect["severity"]) {
  const d: Defect = must(await db.from("vehicle_issues").insert({
    vehicle_id: insp.vehicle_id, title: r.label, description: r.reason, category: r.category, severity, inspection_id: insp.id,
  }).select().single());
  await saveResult(r.id, { defect_id: d.id });
  return d;
}

export const listDefects = async (vehicleId: string): Promise<Defect[]> =>
  must(await db.from("vehicle_issues").select("*").eq("vehicle_id", vehicleId).order("created_at", { ascending: false }));

export const updateDefect = async (id: string, patch: Partial<Defect>) =>
  must(await db.from("vehicle_issues").update(patch).eq("id", id));

export async function uploadFleetFile(vehicleId: string, file: File) {
  const path = `${vehicleId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
  const { error } = await supabase.storage.from("fleet-files").upload(path, file);
  if (error) throw new Error(error.message);
  return { path, name: file.name };
}

export async function openFleetFile(path: string) {
  const { data, error } = await supabase.storage.from("fleet-files").createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  window.open(data.signedUrl, "_blank", "noopener");
}

export async function listFleetStaff(): Promise<{ id: string; name: string | null }[]> {
  return must(await db.rpc("fleet_staff_directory"));
}
