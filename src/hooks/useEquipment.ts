import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { hasAnyRole } from "@/lib/roles";
import {
  addEquipmentUnits,
  assignEquipmentUnit,
  createEquipmentType,
  deleteEquipmentType,
  deleteEquipmentUnit,
  fetchEquipmentTypes,
  fetchEquipmentUnits,
  fetchEquipmentVehicles,
  fetchInternalPeople,
  fetchMaintenanceLogs,
  fetchUnitMovements,
  logEquipmentMaintenance,
  updateEquipmentType,
  updateEquipmentUnit,
  type AddUnitsInput,
  type LogMaintenanceInput,
} from "@/services/equipmentService";
import type {
  EquipmentAssignmentInput,
  EquipmentType,
  EquipmentTypeFormData,
  EquipmentTypeWithCounts,
  EquipmentUnit,
} from "@/types/equipment";

const KEYS = {
  types: ["equipment_types"] as const,
  units: ["equipment_units"] as const,
  people: ["equipment_people"] as const,
  vehicles: ["equipment_vehicles"] as const,
  logs: ["equipment_maintenance_logs"] as const,
};

/** Can the signed-in user add, edit, move or service equipment? */
export function useCanManageEquipment(): boolean {
  const { userProfile } = useAuth();
  return hasAnyRole(userProfile, ["admin", "loader", "fleet_manager"]);
}

export function useEquipmentTypes() {
  return useQuery({
    queryKey: KEYS.types,
    staleTime: 60 * 1000,
    queryFn: () => fetchEquipmentTypes(true),
  });
}

export function useEquipmentUnits() {
  return useQuery({
    queryKey: KEYS.units,
    staleTime: 30 * 1000,
    queryFn: fetchEquipmentUnits,
  });
}

export function useEquipmentPeople() {
  return useQuery({
    queryKey: KEYS.people,
    staleTime: 10 * 60 * 1000,
    queryFn: fetchInternalPeople,
  });
}

export function useEquipmentVehicles() {
  return useQuery({
    queryKey: KEYS.vehicles,
    staleTime: 10 * 60 * 1000,
    queryFn: fetchEquipmentVehicles,
  });
}

export function useMaintenanceLogs(unitId?: string) {
  return useQuery({
    queryKey: [...KEYS.logs, unitId ?? "all"],
    staleTime: 30 * 1000,
    queryFn: () => fetchMaintenanceLogs(unitId),
  });
}

export function useUnitMovements(unitId?: string) {
  return useQuery({
    queryKey: ["equipment_movements", unitId],
    enabled: !!unitId,
    queryFn: () => fetchUnitMovements(unitId as string),
  });
}

/** Types decorated with unit counts derived from the loaded units. */
export function useEquipmentTypesWithCounts(
  types: EquipmentType[] | undefined,
  units: EquipmentUnit[] | undefined,
): EquipmentTypeWithCounts[] {
  return useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (types || []).map((t) => {
      const own = (units || []).filter((u) => u.equipment_type_id === t.id);
      return {
        ...t,
        total_units: own.length,
        available_units: own.filter((u) => u.status === "available").length,
        assigned_units: own.filter((u) => u.status === "assigned").length,
        in_repair_units: own.filter((u) => u.status === "in_repair").length,
        inactive_units: own.filter((u) => u.status === "lost" || u.status === "retired").length,
        due_units: own.filter(
          (u) =>
            u.next_maintenance_due &&
            u.next_maintenance_due <= today &&
            u.status !== "retired" &&
            u.status !== "lost",
        ).length,
      };
    });
  }, [types, units]);
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KEYS.types });
    qc.invalidateQueries({ queryKey: KEYS.units });
    qc.invalidateQueries({ queryKey: KEYS.logs });
    qc.invalidateQueries({ queryKey: ["equipment_movements"] });
  };
}

export function useSaveEquipmentType() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, form }: { id?: string; form: EquipmentTypeFormData }) => {
      if (id) return updateEquipmentType(id, form);
      await createEquipmentType(form);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteEquipmentType() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: deleteEquipmentType, onSuccess: invalidate });
}

export function useAddEquipmentUnits() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: AddUnitsInput) => addEquipmentUnits(input),
    onSuccess: invalidate,
  });
}

export function useUpdateEquipmentUnit() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<EquipmentUnit> }) =>
      updateEquipmentUnit(id, updates),
    onSuccess: invalidate,
  });
}

export function useAssignEquipmentUnit() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: EquipmentAssignmentInput }) =>
      assignEquipmentUnit(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteEquipmentUnit() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: deleteEquipmentUnit, onSuccess: invalidate });
}

export function useLogMaintenance() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: LogMaintenanceInput) => logEquipmentMaintenance(input),
    onSuccess: invalidate,
  });
}
