import React from "react";
import {
  Box,
  CalendarCheck,
  ClipboardCheck,
  MapPinCheck,
  PackageCheck,
  Ship,
  Snowflake,
  Truck,
  Warehouse,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type JourneyIcon =
  | "booked"
  | "collected"
  | "inspected"
  | "repaired"
  | "boxed"
  | "foamed"
  | "ferry"
  | "partner"
  | "transit"
  | "delivered";

export interface JourneyStop {
  label: string;
  detail?: string;
  state: "complete" | "current" | "upcoming" | "failed";
  icon?: JourneyIcon;
}

interface JourneyStripProps {
  stops: JourneyStop[];
  compact?: boolean;
  className?: string;
}

const ICONS: Record<JourneyIcon, LucideIcon> = {
  booked: CalendarCheck,
  collected: PackageCheck,
  inspected: ClipboardCheck,
  repaired: Wrench,
  boxed: Box,
  foamed: Snowflake,
  ferry: Ship,
  partner: Warehouse,
  transit: Truck,
  delivered: MapPinCheck,
};

const JourneyStrip = ({ stops, compact = false, className }: JourneyStripProps) => {
  return (
    <ol aria-label="Order journey" className={cn("grid min-w-0 gap-0", compact ? "grid-flow-col auto-cols-fr" : "grid-cols-1 sm:grid-flow-col sm:auto-cols-fr", className)}>
      {stops.map((stop, index) => {
        const active = stop.state === "complete" || stop.state === "current";
        const MilestoneIcon = stop.icon ? ICONS[stop.icon] : null;
        return (
          <li key={`${stop.label}-${index}`} title={compact ? stop.label : undefined} className={cn("relative flex min-w-0 gap-3 pb-5 sm:block sm:pb-0", compact && "pb-0", !compact && "min-h-16")}>
            {index < stops.length - 1 && <span className={cn("journey-line absolute left-[11px] top-6 h-[calc(100%-18px)] w-1 sm:left-6 sm:top-[11px] sm:h-1 sm:w-[calc(100%-24px)]", active ? "bg-primary" : "bg-border")} />}
            <span className={cn("relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-card", active ? "border-primary text-primary" : "border-border text-muted-foreground", stop.state === "failed" && "border-destructive text-destructive")}>
              {MilestoneIcon ? <MilestoneIcon className="h-3.5 w-3.5" aria-hidden="true" /> : <span className={cn("h-2 w-2 rounded-full", active ? "bg-primary" : "bg-border")} />}
            </span>
            {!compact && <div className="min-w-0 sm:mt-2 sm:pr-3"><div className="text-sm font-bold">{stop.label}</div>{stop.detail && <div className="data-text mt-0.5 text-xs text-muted-foreground">{stop.detail}</div>}</div>}
          </li>
        );
      })}
    </ol>
  );
};

export default JourneyStrip;
