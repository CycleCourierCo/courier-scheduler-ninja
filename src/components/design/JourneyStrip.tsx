import React from "react";
import { Bike, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

export interface JourneyStop {
  label: string;
  detail?: string;
  state: "complete" | "current" | "upcoming" | "failed";
}

interface JourneyStripProps {
  stops: JourneyStop[];
  compact?: boolean;
  className?: string;
}

const JourneyStrip = ({ stops, compact = false, className }: JourneyStripProps) => {
  const current = Math.max(0, stops.findIndex((stop) => stop.state === "current"));
  return (
    <ol aria-label="Order journey" className={cn("grid gap-0", compact ? "grid-flow-col auto-cols-fr" : "grid-cols-1 sm:grid-flow-col sm:auto-cols-fr", className)}>
      {stops.map((stop, index) => {
        const active = stop.state === "complete" || stop.state === "current";
        return (
          <li key={`${stop.label}-${index}`} className={cn("relative flex gap-3 pb-5 sm:block sm:pb-0", !compact && "min-h-16")}>
            {index < stops.length - 1 && <span className={cn("journey-line absolute left-[11px] top-6 h-[calc(100%-18px)] w-1 sm:left-6 sm:top-[11px] sm:h-1 sm:w-[calc(100%-24px)]", active ? "bg-primary" : "bg-border")} />}
            <span className={cn("relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-card", active ? "border-primary" : "border-border", stop.state === "failed" && "border-destructive")}>
              {stop.state === "current" ? <Truck className="journey-van h-3.5 w-3.5 text-primary" /> : index === stops.length - 1 ? <Bike className="h-3 w-3" /> : <span className={cn("h-2 w-2 rounded-full", active ? "bg-primary" : "bg-border")} />}
            </span>
            {!compact && <div className="min-w-0 sm:mt-2 sm:pr-3"><div className="text-sm font-bold">{stop.label}</div>{stop.detail && <div className="data-text mt-0.5 text-xs text-muted-foreground">{stop.detail}</div>}</div>}
          </li>
        );
      })}
    </ol>
  );
};

export default JourneyStrip;