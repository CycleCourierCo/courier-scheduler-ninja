import { Badge } from "@/components/ui/badge";
import type { DueItem } from "@/services/vehicleMaintenanceService";

const formatRemaining = (d: DueItem) => {
  if (d.neverDone) return "Not logged";
  if (d.status === "red") {
    if (d.remainingMiles != null && d.remainingMiles < 0)
      return `Overdue by ${Math.abs(d.remainingMiles).toLocaleString("en-GB")} mi`;
    if (d.remainingDays != null && d.remainingDays < 0)
      return `Overdue by ${Math.abs(d.remainingDays)} days`;
    return "Overdue";
  }
  if (d.remainingMiles != null && d.remainingDays != null) {
    return `${d.remainingMiles.toLocaleString("en-GB")} mi / ${d.remainingDays}d left`;
  }
  if (d.remainingMiles != null)
    return `${d.remainingMiles.toLocaleString("en-GB")} mi left`;
  if (d.remainingDays != null) return `${d.remainingDays} days left`;
  return "—";
};

const MaintenanceStatusBadge = ({ item }: { item: DueItem }) => {
  const classes =
    item.status === "red"
      ? "bg-destructive text-destructive-foreground hover:bg-destructive"
      : item.status === "amber"
      ? "bg-amber-500 text-white hover:bg-amber-500"
      : item.status === "ok"
      ? "bg-emerald-600 text-white hover:bg-emerald-600"
      : "bg-muted text-muted-foreground hover:bg-muted";
  return (
    <Badge className={classes} variant="secondary">
      {formatRemaining(item)}
    </Badge>
  );
};

export default MaintenanceStatusBadge;
