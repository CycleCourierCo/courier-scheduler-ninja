import React from "react";
import { BIKE_HOTSPOTS, type BikeHotspot } from "@/constants/bikeComponents";
import { cn } from "@/lib/utils";

type Props = {
  countsBySlot: Record<string, number>;
  onSelectSlot: (hotspot: BikeHotspot) => void;
  disabled?: boolean;
};

/** Simple side-on bike outline with clickable areas for each component group. */
const BikeDiagram: React.FC<Props> = ({ countsBySlot, onSelectSlot, disabled }) => {
  return (
    <div className="relative w-full max-w-xl mx-auto aspect-[16/10] rounded-lg border bg-muted/30">
      <svg viewBox="0 0 320 200" className="absolute inset-0 h-full w-full text-muted-foreground">
        {/* wheels */}
        <circle cx="62" cy="150" r="42" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle cx="258" cy="150" r="42" fill="none" stroke="currentColor" strokeWidth="3" />
        {/* frame */}
        <path
          d="M62 150 L124 150 L168 66 L214 66 M124 150 L176 66 M124 150 L232 118 M168 66 L232 118 M232 118 L258 150"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* saddle + bars */}
        <path d="M156 60 L188 60" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <path d="M214 66 L214 48 M198 48 L234 48" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        {/* cranks */}
        <circle cx="124" cy="150" r="12" fill="none" stroke="currentColor" strokeWidth="3" />
      </svg>

      {BIKE_HOTSPOTS.map((hotspot) => {
        const count = countsBySlot[hotspot.slot] || 0;
        return (
          <button
            key={hotspot.slot}
            type="button"
            disabled={disabled}
            onClick={() => onSelectSlot(hotspot)}
            style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-1 text-[11px] font-medium shadow-sm transition",
              "bg-background/95 hover:bg-primary hover:text-primary-foreground",
              count > 0 && "border-primary text-primary",
              disabled && "opacity-60 cursor-not-allowed hover:bg-background/95 hover:text-foreground"
            )}
          >
            {hotspot.label}
            {count > 0 && <span className="ml-1 font-semibold">({count})</span>}
          </button>
        );
      })}
    </div>
  );
};

export default BikeDiagram;
