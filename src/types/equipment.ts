export type EquipmentUnitStatus = "available" | "assigned" | "in_repair" | "lost" | "retired";
export type EquipmentCondition = "new" | "good" | "fair" | "poor" | "unusable";
export type EquipmentAssignmentKind = "site" | "vehicle" | "person";
export type EquipmentMaintenanceResult = "pass" | "advisory" | "fail";

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentUnitStatus, string> = {
  available: "Available",
  assigned: "Assigned",
  in_repair: "In repair",
  lost: "Lost",
  retired: "Retired",
};

export const EQUIPMENT_CONDITION_LABELS: Record<EquipmentCondition, string> = {
  new: "New",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  unusable: "Unusable",
};

export const EQUIPMENT_RESULT_LABELS: Record<EquipmentMaintenanceResult, string> = {
  pass: "Pass",
  advisory: "Advisory",
  fail: "Fail",
};

export interface EquipmentType {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  manufacturer: string | null;
  model: string | null;
  requires_maintenance: boolean;
  maintenance_interval_days: number | null;
  default_site_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EquipmentTypeWithCounts extends EquipmentType {
  total_units: number;
  available_units: number;
  assigned_units: number;
  in_repair_units: number;
  inactive_units: number;
  due_units: number;
}

export interface EquipmentUnit {
  id: string;
  equipment_type_id: string;
  serial: string | null;
  asset_tag: string | null;
  status: EquipmentUnitStatus;
  condition: EquipmentCondition;
  assignment_kind: EquipmentAssignmentKind | null;
  site_id: string | null;
  vehicle_id: string | null;
  assigned_to_user_id: string | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  last_maintenance_at: string | null;
  next_maintenance_due: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EquipmentMovement {
  id: string;
  unit_id: string;
  from_assignment_kind: EquipmentAssignmentKind | null;
  from_site_id: string | null;
  from_vehicle_id: string | null;
  from_user_id: string | null;
  to_assignment_kind: EquipmentAssignmentKind | null;
  to_site_id: string | null;
  to_vehicle_id: string | null;
  to_user_id: string | null;
  moved_by: string | null;
  moved_at: string;
  notes: string | null;
}

export interface EquipmentMaintenanceLog {
  id: string;
  unit_id: string;
  performed_at: string;
  performed_by: string | null;
  result: EquipmentMaintenanceResult;
  notes: string | null;
  next_due_at: string | null;
  cost: number | null;
  created_at: string;
}

export interface EquipmentTypeFormData {
  name: string;
  category: string;
  description: string;
  manufacturer: string;
  model: string;
  requires_maintenance: boolean;
  maintenance_interval_days: string;
  default_site_id: string | null;
  is_active: boolean;
}

export interface EquipmentAssignmentInput {
  assignment_kind: EquipmentAssignmentKind | null;
  site_id: string | null;
  vehicle_id: string | null;
  assigned_to_user_id: string | null;
  status: EquipmentUnitStatus;
  condition: EquipmentCondition;
  notes?: string | null;
}
