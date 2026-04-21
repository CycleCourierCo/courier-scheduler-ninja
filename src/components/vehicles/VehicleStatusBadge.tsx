import { Badge } from "@/components/ui/badge";
import type { VehicleStatus } from "@/services/vehicleService";

const STATUS_LABEL: Record<VehicleStatus, string> = {
  purchased: "Purchased",
  in_prep: "In Prep",
  in_use: "In Use",
  in_service: "In Service",
  in_repair: "In Repair",
  mot_due: "MOT Due",
  reserved: "Reserved",
  sold: "Sold",
  off_road: "Off Road",
  awaiting_sale: "Awaiting Sale",
  written_off: "Written Off",
};

const STATUS_CLASS: Record<VehicleStatus, string> = {
  purchased: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  in_prep: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  in_use: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  in_service: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  in_repair: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  mot_due: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
  reserved: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
  sold: "bg-muted text-muted-foreground border-border",
  off_road: "bg-destructive/15 text-destructive border-destructive/30",
  awaiting_sale: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  written_off: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
};

export const VehicleStatusBadge = ({ status, className }: { status: VehicleStatus; className?: string }) => (
  <Badge variant="outline" className={`${STATUS_CLASS[status]} ${className ?? ""}`}>
    {STATUS_LABEL[status]}
  </Badge>
);

export default VehicleStatusBadge;
