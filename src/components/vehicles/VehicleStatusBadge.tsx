import { Badge } from "@/components/ui/badge";
import type { VehicleStatus } from "@/services/vehicleService";

const STATUS_LABEL: Record<VehicleStatus, string> = {
  purchased: "Purchased",
  in_prep: "In Prep",
  in_use: "In Use",
  sold: "Sold",
  off_road: "Off Road",
};

const STATUS_CLASS: Record<VehicleStatus, string> = {
  purchased: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  in_prep: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  in_use: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  sold: "bg-muted text-muted-foreground border-border",
  off_road: "bg-destructive/15 text-destructive border-destructive/30",
};

export const VehicleStatusBadge = ({ status }: { status: VehicleStatus }) => (
  <Badge variant="outline" className={STATUS_CLASS[status]}>
    {STATUS_LABEL[status]}
  </Badge>
);

export default VehicleStatusBadge;
