import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { InsurancePolicy } from "@/services/insuranceService";
import type { Vehicle } from "@/services/vehicleService";

interface Props {
  vehicles: Vehicle[];
  policies: InsurancePolicy[];
  monthsCount: number;
  startMonth: Date; // first day of first month shown
  onPolicyClick: (p: InsurancePolicy) => void;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function diffDays(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

const MONTH_FMT = new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit" });

export default function InsuranceTimeline({
  vehicles, policies, monthsCount, startMonth, onPolicyClick,
}: Props) {
  const rangeStart = startOfMonth(startMonth);
  const rangeEnd = addMonths(rangeStart, monthsCount); // exclusive
  const totalDays = diffDays(rangeEnd, rangeStart);

  const months = useMemo(() => {
    return Array.from({ length: monthsCount }, (_, i) => {
      const m = addMonths(rangeStart, i);
      const next = addMonths(rangeStart, i + 1);
      const offsetDays = diffDays(m, rangeStart);
      const widthDays = diffDays(next, m);
      return {
        date: m,
        label: MONTH_FMT.format(m),
        leftPct: (offsetDays / totalDays) * 100,
        widthPct: (widthDays / totalDays) * 100,
      };
    });
  }, [rangeStart, monthsCount, totalDays]);

  const today = new Date();
  const todayPct = today >= rangeStart && today < rangeEnd
    ? (diffDays(today, rangeStart) / totalDays) * 100
    : null;

  const sortedVehicles = useMemo(
    () => [...vehicles].sort((a, b) => a.registration.localeCompare(b.registration)),
    [vehicles],
  );

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          {/* Header months */}
          <div className="flex border-b bg-muted/30">
            <div className="w-40 shrink-0 px-3 py-2 text-xs font-medium text-muted-foreground border-r">
              Vehicle
            </div>
            <div className="relative flex-1 h-9">
              {months.map((m, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l text-xs text-muted-foreground flex items-center px-2"
                  style={{ left: `${m.leftPct}%`, width: `${m.widthPct}%` }}
                >
                  {m.label}
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          <TooltipProvider delayDuration={150}>
            {sortedVehicles.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">No vehicles</div>
            ) : (
              sortedVehicles.map((v) => {
                const vPolicies = policies.filter((p) => p.vehicle_id === v.id);
                return (
                  <div key={v.id} className="flex border-b last:border-b-0 hover:bg-muted/20">
                    <div className="w-40 shrink-0 px-3 py-3 text-sm border-r">
                      <div className="font-mono font-semibold">{v.registration}</div>
                      <div className="text-xs text-muted-foreground truncate">{v.make ?? ""}</div>
                    </div>
                    <div className="relative flex-1 h-12">
                      {/* Month gridlines */}
                      {months.map((m, i) => (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 border-l border-border/60"
                          style={{ left: `${m.leftPct}%` }}
                        />
                      ))}
                      {/* Today marker */}
                      {todayPct !== null && (
                        <div
                          className="absolute top-0 bottom-0 w-px bg-destructive/70 z-10"
                          style={{ left: `${todayPct}%` }}
                        />
                      )}
                      {/* Policy bars */}
                      {vPolicies.map((p) => {
                        const ps = new Date(p.start_date);
                        const pe = new Date(p.end_date);
                        // Clamp into range
                        const visStart = ps < rangeStart ? rangeStart : ps;
                        const visEnd = pe > rangeEnd ? rangeEnd : pe;
                        if (visEnd <= rangeStart || visStart >= rangeEnd) return null;
                        const leftPct = (diffDays(visStart, rangeStart) / totalDays) * 100;
                        const widthPct = (diffDays(visEnd, visStart) / totalDays) * 100;
                        const isCurrent = ps <= today && pe >= today;
                        return (
                          <Tooltip key={p.id}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => onPolicyClick(p)}
                                className={`absolute top-2 bottom-2 rounded-md px-2 text-[11px] font-medium truncate text-left transition-opacity hover:opacity-80 ${
                                  isCurrent ? "bg-primary text-primary-foreground" : "bg-muted-foreground/40 text-foreground"
                                }`}
                                style={{ left: `${leftPct}%`, width: `max(${widthPct}%, 12px)` }}
                              >
                                {p.insurer}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs">
                                <div className="font-medium">{p.insurer}</div>
                                {p.policy_number && <div>#{p.policy_number}</div>}
                                <div>{p.start_date} → {p.end_date}</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </TooltipProvider>
        </div>
      </div>
    </Card>
  );
}
