import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowUpDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatGBP,
  type CustomerBikeValueRow,
} from "@/services/bikeValueAnalyticsService";

type SortKey =
  | "totalValue"
  | "avgValuePerBike"
  | "totalBikes"
  | "highestBikeValue";

interface Props {
  rows: CustomerBikeValueRow[];
  rangeLabel: string;
  selectedCustomer: string | null;
  onSelectCustomer: (name: string | null) => void;
}

const BikeValueLeaderboard = ({
  rows,
  rangeLabel,
  selectedCustomer,
  onSelectCustomer,
}: Props) => {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("totalValue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => r.customerName.toLowerCase().includes(q))
      : rows;
    const arr = [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [rows, query, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  const TH = ({
    k,
    children,
  }: {
    k: SortKey;
    children: React.ReactNode;
  }) => (
    <th
      onClick={() => toggleSort(k)}
      className={cn(
        "px-3 py-2 cursor-pointer select-none whitespace-nowrap text-right",
        sortKey === k && "text-foreground",
      )}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </span>
    </th>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Customer Value Leaderboard</CardTitle>
            <CardDescription>
              Total and average bike value sent per customer · {rangeLabel}
              {selectedCustomer && (
                <>
                  {" "}· Filtered to <span className="font-medium">{selectedCustomer}</span>
                </>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {selectedCustomer && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSelectCustomer(null)}
              >
                <X className="h-3 w-3 mr-1" /> Clear filter
              </Button>
            )}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search customer…"
                className="pl-8"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[32rem] rounded-md border">
          <div className="min-w-[720px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                <tr className="text-muted-foreground">
                  <th className="px-3 py-2 w-14 text-left">#</th>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <TH k="totalBikes">Bikes</TH>
                  <TH k="totalValue">Total Value</TH>
                  <TH k="avgValuePerBike">Avg / Bike</TH>
                  <TH k="highestBikeValue">Top Bike</TH>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      No customers with bikes in this period.
                    </td>
                  </tr>
                ) : (
                  sorted.map((r) => {
                    const rank = rows.findIndex((x) => x.customerName === r.customerName) + 1;
                    const isSelected = selectedCustomer === r.customerName;
                    return (
                      <tr
                        key={r.customerName}
                        onClick={() =>
                          onSelectCustomer(isSelected ? null : r.customerName)
                        }
                        className={cn(
                          "cursor-pointer border-t border-border transition-colors hover:bg-accent/50",
                          isSelected && "bg-accent",
                        )}
                      >
                        <td className="px-3 py-2 font-medium text-muted-foreground">#{rank}</td>
                        <td className="px-3 py-2 font-medium">
                          <div className="flex items-center gap-2">
                            <span>{r.customerName}</span>
                            {isSelected && <Badge variant="secondary" className="text-[10px]">Filtered</Badge>}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">{r.totalBikes}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatGBP(r.totalValue)}</td>
                        <td className="px-3 py-2 text-right">
                          {r.valuedBikes > 0 ? formatGBP(r.avgValuePerBike) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {r.highestBikeValue > 0 ? formatGBP(r.highestBikeValue) : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default BikeValueLeaderboard;
