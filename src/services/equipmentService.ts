import { supabase } from "@/integrations/supabase/client";
import type {
  EquipmentAssignmentInput,
  EquipmentMaintenanceLog,
  EquipmentMaintenanceResult,
  EquipmentMovement,
  EquipmentType,
  EquipmentTypeFormData,
  EquipmentUnit,
  EquipmentUnitStatus,
} from "@/types/equipment";

const table = (name: string) => (supabase.from(name as any) as any);

/* ------------------------------- types ---------------------------------- */

export async function fetchEquipmentTypes(includeInactive = true): Promise<EquipmentType[]> {
  let query = table("equipment_types").select("*").order("name");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as EquipmentType[];
}

const typePayload = (form: EquipmentTypeFormData) => {
  const interval = parseInt(form.maintenance_interval_days, 10);
  return {
    name: form.name.trim(),
    category: form.category.trim() || null,
    description: form.description.trim() || null,
    manufacturer: form.manufacturer.trim() || null,
    model: form.model.trim() || null,
    requires_maintenance: form.requires_maintenance,
    maintenance_interval_days:
      form.requires_maintenance && Number.isFinite(interval) && interval > 0 ? interval : null,
    default_site_id: form.default_site_id || null,
    is_active: form.is_active,
  };
};

export async function createEquipmentType(form: EquipmentTypeFormData): Promise<EquipmentType> {
  const { data, error } = await table("equipment_types").insert(typePayload(form)).select().single();
  if (error) throw error;
  return data as EquipmentType;
}

export async function updateEquipmentType(
  id: string,
  form: EquipmentTypeFormData,
): Promise<void> {
  const { error } = await table("equipment_types").update(typePayload(form)).eq("id", id);
  if (error) throw error;
}

export async function deleteEquipmentType(id: string): Promise<void> {
  const { error } = await table("equipment_types").delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------- units ---------------------------------- */

export async function fetchEquipmentUnits(): Promise<EquipmentUnit[]> {
  const { data, error } = await table("equipment_units")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as EquipmentUnit[];
}

export interface AddUnitsInput {
  equipment_type_id: string;
  quantity: number;
  serialPrefix?: string;
  serialStart?: number;
  serialPad?: number;
  serials?: string[];
  condition: EquipmentUnit["condition"];
  site_id: string | null;
  purchase_date: string | null;
  purchase_cost: string;
  notes: string;
}

/** Build the serial list for a bulk add: explicit serials win over a prefix sequence. */
export function buildSerials(input: AddUnitsInput): (string | null)[] {
  if (input.serials && input.serials.length) {
    return input.serials.slice(0, input.quantity).map((s) => s.trim() || null);
  }
  const prefix = (input.serialPrefix || "").trim();
  if (!prefix) return Array.from({ length: input.quantity }, () => null);
  const start = input.serialStart && input.serialStart > 0 ? input.serialStart : 1;
  const pad = input.serialPad && input.serialPad > 0 ? input.serialPad : 3;
  return Array.from({ length: input.quantity }, (_, i) =>
    `${prefix}${String(start + i).padStart(pad, "0")}`,
  );
}

export async function addEquipmentUnits(input: AddUnitsInput): Promise<number> {
  const serials = buildSerials(input);
  const cost = parseFloat(input.purchase_cost);
  const rows = serials.map((serial) => ({
    equipment_type_id: input.equipment_type_id,
    serial,
    status: "available" as EquipmentUnitStatus,
    condition: input.condition,
    assignment_kind: input.site_id ? "site" : null,
    site_id: input.site_id,
    purchase_date: input.purchase_date || null,
    purchase_cost: Number.isFinite(cost) ? cost : null,
    notes: input.notes.trim() || null,
  }));

  const { error } = await table("equipment_units").insert(rows);
  if (error) throw error;
  return rows.length;
}

export async function updateEquipmentUnit(
  id: string,
  updates: Partial<EquipmentUnit>,
): Promise<void> {
  const { error } = await table("equipment_units").update(updates).eq("id", id);
  if (error) throw error;
}

export async function assignEquipmentUnit(
  id: string,
  input: EquipmentAssignmentInput,
): Promise<void> {
  const { error } = await table("equipment_units")
    .update({
      assignment_kind: input.assignment_kind,
      site_id: input.assignment_kind === "site" ? input.site_id : null,
      vehicle_id: input.assignment_kind === "vehicle" ? input.vehicle_id : null,
      assigned_to_user_id: input.assignment_kind === "person" ? input.assigned_to_user_id : null,
      status: input.status,
      condition: input.condition,
      notes: input.notes ?? undefined,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteEquipmentUnit(id: string): Promise<void> {
  const { error } = await table("equipment_units").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------------------- movements --------------------------------- */

export async function fetchUnitMovements(unitId: string): Promise<EquipmentMovement[]> {
  const { data, error } = await table("equipment_movements")
    .select("*")
    .eq("unit_id", unitId)
    .order("moved_at", { ascending: false });
  if (error) throw error;
  return (data || []) as EquipmentMovement[];
}

/* --------------------------- maintenance -------------------------------- */

export async function fetchMaintenanceLogs(unitId?: string): Promise<EquipmentMaintenanceLog[]> {
  let query = table("equipment_maintenance_logs")
    .select("*")
    .order("performed_at", { ascending: false })
    .limit(500);
  if (unitId) query = query.eq("unit_id", unitId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as EquipmentMaintenanceLog[];
}

export interface LogMaintenanceInput {
  unit_id: string;
  performed_at: string;
  result: EquipmentMaintenanceResult;
  notes: string;
  next_due_at: string | null;
  cost: string;
  /** Set the unit out of service when the check failed. */
  markInRepair?: boolean;
}

export async function logEquipmentMaintenance(input: LogMaintenanceInput): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const cost = parseFloat(input.cost);

  const { error } = await table("equipment_maintenance_logs").insert({
    unit_id: input.unit_id,
    performed_at: new Date(input.performed_at).toISOString(),
    performed_by: userData?.user?.id ?? null,
    result: input.result,
    notes: input.notes.trim() || null,
    next_due_at: input.next_due_at || null,
    cost: Number.isFinite(cost) ? cost : null,
  });
  if (error) throw error;

  const unitUpdates: Record<string, unknown> = {
    last_maintenance_at: new Date(input.performed_at).toISOString(),
  };
  // An explicit next-due date always wins; otherwise the DB trigger derives it
  // from the type's maintenance interval.
  if (input.next_due_at) unitUpdates.next_maintenance_due = input.next_due_at;
  if (input.markInRepair) unitUpdates.status = "in_repair";

  const { error: unitError } = await table("equipment_units").update(unitUpdates).eq("id", input.unit_id);
  if (unitError) throw unitError;
}

/* ------------------------------ people ---------------------------------- */

export interface InternalPerson {
  id: string;
  name: string | null;
  email: string | null;
}

export async function fetchInternalPeople(): Promise<InternalPerson[]> {
  const { data, error } = await (supabase as any).rpc("list_internal_users");
  if (error) throw error;
  return ((data || []) as InternalPerson[]).sort((a, b) =>
    (a.name || a.email || "").localeCompare(b.name || b.email || ""),
  );
}

export interface EquipmentVehicle {
  id: string;
  registration: string;
  make: string | null;
  model: string | null;
}

export async function fetchEquipmentVehicles(): Promise<EquipmentVehicle[]> {
  const { data, error } = await table("vehicles")
    .select("id, registration, make, model")
    .order("registration");
  if (error) throw error;
  return (data || []) as EquipmentVehicle[];
}
