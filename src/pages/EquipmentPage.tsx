import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, Boxes, Edit, Package, Plus, Search, Trash2, Wrench,
} from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useSites } from "@/hooks/useSites";
import {
  useCanManageEquipment,
  useDeleteEquipmentType,
  useDeleteEquipmentUnit,
  useEquipmentPeople,
  useEquipmentTypes,
  useEquipmentTypesWithCounts,
  useEquipmentUnits,
  useEquipmentVehicles,
} from "@/hooks/useEquipment";
import EquipmentTypeDialog from "@/components/equipment/EquipmentTypeDialog";
import AddEquipmentUnitsDialog from "@/components/equipment/AddEquipmentUnitsDialog";
import AssignEquipmentDialog from "@/components/equipment/AssignEquipmentDialog";
import EquipmentMaintenanceDialog from "@/components/equipment/EquipmentMaintenanceDialog";
import {
  EQUIPMENT_CONDITION_LABELS,
  EQUIPMENT_STATUS_LABELS,
  type EquipmentType,
  type EquipmentTypeWithCounts,
  type EquipmentUnit,
  type EquipmentUnitStatus,
} from "@/types/equipment";

const statusVariant = (status: EquipmentUnitStatus) => {
  switch (status) {
    case "available":
      return "bg-emerald-600 hover:bg-emerald-600 text-white";
    case "assigned":
      return "bg-courier-600 hover:bg-courier-600 text-white";
    case "in_repair":
      return "bg-amber-600 hover:bg-amber-600 text-white";
    default:
      return "";
  }
};

const EquipmentPage: React.FC = () => {
  const canManage = useCanManageEquipment();
  const { data: types = [], isLoading: typesLoading } = useEquipmentTypes();
  const { data: units = [], isLoading: unitsLoading } = useEquipmentUnits();
  const { data: sites = [] } = useSites(true);
  const { data: people = [] } = useEquipmentPeople();
  const { data: vehicles = [] } = useEquipmentVehicles();
  const deleteType = useDeleteEquipmentType();
  const deleteUnit = useDeleteEquipmentUnit();

  const typesWithCounts = useEquipmentTypesWithCounts(types, units);

  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<EquipmentType | null>(null);
  const [addUnitsOpen, setAddUnitsOpen] = useState(false);
  const [presetTypeId, setPresetTypeId] = useState<string | null>(null);
  const [assignUnit, setAssignUnit] = useState<EquipmentUnit | null>(null);
  const [maintenanceUnit, setMaintenanceUnit] = useState<EquipmentUnit | null>(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const typeName = (id: string) => types.find((t) => t.id === id)?.name || "Equipment";

  const locationLabel = (unit: EquipmentUnit) => {
    if (unit.assignment_kind === "site")
      return sites.find((s) => s.id === unit.site_id)?.name || "Site";
    if (unit.assignment_kind === "vehicle")
      return vehicles.find((v) => v.id === unit.vehicle_id)?.registration || "Vehicle";
    if (unit.assignment_kind === "person") {
      const p = people.find((x) => x.id === unit.assigned_to_user_id);
      return p?.name || p?.email || "Staff member";
    }
    return "Unassigned";
  };

  const filteredUnits = useMemo(() => {
    const q = search.trim().toLowerCase();
    return units.filter((u) => {
      if (typeFilter !== "all" && u.equipment_type_id !== typeFilter) return false;
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (!q) return true;
      return [u.serial, u.asset_tag, typeName(u.equipment_type_id), locationLabel(u)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [units, search, typeFilter, statusFilter, types, sites, people, vehicles]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const dueUnits = units.filter(
    (u) =>
      u.next_maintenance_due &&
      u.next_maintenance_due <= todayStr &&
      u.status !== "retired" &&
      u.status !== "lost",
  );

  const totals = {
    items: units.length,
    available: units.filter((u) => u.status === "available").length,
    assigned: units.filter((u) => u.status === "assigned").length,
    inRepair: units.filter((u) => u.status === "in_repair").length,
  };

  const handleDeleteType = async (type: EquipmentType) => {
    const owned = units.filter((u) => u.equipment_type_id === type.id).length;
    if (owned > 0) {
      toast.error("Remove the items in this group first, then delete the group.");
      return;
    }
    if (!window.confirm(`Delete "${type.name}"?`)) return;
    try {
      await deleteType.mutateAsync(type.id);
      toast.success("Equipment deleted");
    } catch (error: any) {
      toast.error(error?.message || "Could not delete this equipment");
    }
  };

  const handleDeleteUnit = async (unit: EquipmentUnit) => {
    if (!window.confirm("Remove this item from the register?")) return;
    try {
      await deleteUnit.mutateAsync(unit.id);
      toast.success("Item removed");
    } catch (error: any) {
      toast.error(error?.message || "Could not remove this item");
    }
  };

  const UnitActions: React.FC<{ unit: EquipmentUnit }> = ({ unit }) =>
    canManage ? (
      <div className="flex items-center justify-end gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setAssignUnit(unit)}
          title="Move or update"
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setMaintenanceUnit(unit)}
          title="Log a check"
        >
          <Wrench className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleDeleteUnit(unit)}
          title="Remove item"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    ) : null;

  const GroupActions: React.FC<{ type: EquipmentTypeWithCounts }> = ({ type }) =>
    canManage ? (
      <div className="flex items-center justify-end gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setPresetTypeId(type.id);
            setAddUnitsOpen(true);
          }}
          title="Add items"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setEditingType(type);
            setTypeDialogOpen(true);
          }}
          title="Edit"
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleDeleteType(type)}
          title="Delete"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    ) : null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Equipment</h1>
            <p className="text-muted-foreground">
              Track racking, wheel adapters and other kit across sites, vans and staff.
            </p>
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingType(null);
                  setTypeDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> New equipment
              </Button>
              <Button
                onClick={() => {
                  setPresetTypeId(null);
                  setAddUnitsOpen(true);
                }}
                disabled={types.length === 0}
              >
                <Boxes className="mr-2 h-4 w-4" /> Add items
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Items tracked", value: totals.items, icon: Package },
            { label: "Available", value: totals.available, icon: Boxes },
            { label: "Out in use", value: totals.assigned, icon: Package },
            { label: "In repair", value: totals.inRepair, icon: Wrench },
          ].map((card) => (
            <Card key={card.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <card.icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-2xl font-semibold">{card.value}</p>
                  <p className="truncate text-xs text-muted-foreground">{card.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {dueUnits.length > 0 && (
          <Card className="border-amber-500/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                {dueUnits.length} item{dueUnits.length === 1 ? "" : "s"} due a check
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 pt-0">
              {dueUnits.slice(0, 12).map((u) => (
                <Button
                  key={u.id}
                  size="sm"
                  variant="outline"
                  onClick={() => setMaintenanceUnit(u)}
                  disabled={!canManage}
                >
                  {typeName(u.equipment_type_id)}
                  {u.serial ? ` · ${u.serial}` : ""}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="items">
          <TabsList>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="groups">Equipment groups</TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="space-y-4 pt-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search serial, equipment or location"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="sm:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All equipment</SelectItem>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {Object.entries(EQUIPMENT_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card className="hidden md:block">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipment</TableHead>
                        <TableHead>Serial</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Condition</TableHead>
                        <TableHead>Next check</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unitsLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                            Loading equipment...
                          </TableCell>
                        </TableRow>
                      ) : filteredUnits.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                            No items match these filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUnits.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium">
                              {typeName(u.equipment_type_id)}
                            </TableCell>
                            <TableCell>{u.serial || u.asset_tag || "—"}</TableCell>
                            <TableCell>
                              <Badge
                                className={statusVariant(u.status)}
                                variant={statusVariant(u.status) ? "default" : "outline"}
                              >
                                {EQUIPMENT_STATUS_LABELS[u.status]}
                              </Badge>
                            </TableCell>
                            <TableCell>{locationLabel(u)}</TableCell>
                            <TableCell>{EQUIPMENT_CONDITION_LABELS[u.condition]}</TableCell>
                            <TableCell>
                              {u.next_maintenance_due ? (
                                <span
                                  className={
                                    u.next_maintenance_due <= todayStr
                                      ? "text-amber-600 font-medium"
                                      : ""
                                  }
                                >
                                  {new Date(u.next_maintenance_due).toLocaleDateString("en-GB")}
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <UnitActions unit={u} />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <div className="md:hidden space-y-3">
              {unitsLoading ? (
                <p className="py-8 text-center text-muted-foreground">Loading equipment...</p>
              ) : filteredUnits.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No items match these filters.</p>
              ) : (
                filteredUnits.map((u) => (
                  <Card key={u.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{typeName(u.equipment_type_id)}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {u.serial || u.asset_tag || "No serial"}
                          </p>
                        </div>
                        <UnitActions unit={u} />
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Status</p>
                          <Badge
                            className={statusVariant(u.status)}
                            variant={statusVariant(u.status) ? "default" : "outline"}
                          >
                            {EQUIPMENT_STATUS_LABELS[u.status]}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Condition</p>
                          <p>{EQUIPMENT_CONDITION_LABELS[u.condition]}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Location</p>
                          <p className="truncate">{locationLabel(u)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Next check</p>
                          <p>
                            {u.next_maintenance_due ? (
                              <span
                                className={
                                  u.next_maintenance_due <= todayStr
                                    ? "text-amber-600 font-medium"
                                    : ""
                                }
                              >
                                {new Date(u.next_maintenance_due).toLocaleDateString("en-GB")}
                              </span>
                            ) : (
                              "—"
                            )}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="groups" className="pt-4 space-y-4">
            <Card className="hidden md:block">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Available</TableHead>
                        <TableHead>Out</TableHead>
                        <TableHead>In repair</TableHead>
                        <TableHead>Checks</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {typesLoading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                            Loading...
                          </TableCell>
                        </TableRow>
                      ) : typesWithCounts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                            No equipment set up yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        typesWithCounts.map((t) => (
                          <TableRow key={t.id} className={t.is_active ? "" : "opacity-60"}>
                            <TableCell className="font-medium">
                              {t.name}
                              {!t.is_active && (
                                <Badge variant="outline" className="ml-2">
                                  Inactive
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{t.category || "—"}</TableCell>
                            <TableCell>{t.total_units}</TableCell>
                            <TableCell>{t.available_units}</TableCell>
                            <TableCell>{t.assigned_units}</TableCell>
                            <TableCell>{t.in_repair_units}</TableCell>
                            <TableCell>
                              {t.requires_maintenance
                                ? `Every ${t.maintenance_interval_days} days${t.due_units ? ` · ${t.due_units} due` : ""}`
                                : "Not required"}
                            </TableCell>
                            <TableCell className="text-right">
                              <GroupActions type={t} />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <div className="md:hidden space-y-3">
              {typesLoading ? (
                <p className="py-8 text-center text-muted-foreground">Loading...</p>
              ) : typesWithCounts.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No equipment set up yet.</p>
              ) : (
                typesWithCounts.map((t) => (
                  <Card key={t.id} className={t.is_active ? "" : "opacity-60"}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {t.name}
                            {!t.is_active && (
                              <Badge variant="outline" className="ml-2">
                                Inactive
                              </Badge>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {t.category || "No category"}
                          </p>
                        </div>
                        <GroupActions type={t} />
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p>{t.total_units}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Available</p>
                          <p>{t.available_units}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Out</p>
                          <p>{t.assigned_units}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">In repair</p>
                          <p>{t.in_repair_units}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">Checks</p>
                          <p>
                            {t.requires_maintenance
                              ? `Every ${t.maintenance_interval_days} days${t.due_units ? ` · ${t.due_units} due` : ""}`
                              : "Not required"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <EquipmentTypeDialog
        open={typeDialogOpen}
        onOpenChange={setTypeDialogOpen}
        editing={editingType}
      />
      <AddEquipmentUnitsDialog
        open={addUnitsOpen}
        onOpenChange={setAddUnitsOpen}
        types={types}
        presetTypeId={presetTypeId}
      />
      <AssignEquipmentDialog
        open={!!assignUnit}
        onOpenChange={(open) => !open && setAssignUnit(null)}
        unit={assignUnit}
        typeName={assignUnit ? typeName(assignUnit.equipment_type_id) : undefined}
      />
      <EquipmentMaintenanceDialog
        open={!!maintenanceUnit}
        onOpenChange={(open) => !open && setMaintenanceUnit(null)}
        unit={maintenanceUnit}
        typeName={maintenanceUnit ? typeName(maintenanceUnit.equipment_type_id) : undefined}
      />
    </Layout>
  );
};

export default EquipmentPage;
