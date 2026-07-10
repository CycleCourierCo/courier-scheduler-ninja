import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPerformanceLeaderboard, type PerformanceLeaderboardRow, type TimeRange } from "@/services/analyticsService";
import type { Order } from "@/types/order";
import CustomerOrdersDialog from "./CustomerOrdersDialog";

interface Props {
  orders: Order[];
  range: TimeRange;
}

type SortKey =
  | "orders"
  | "avgCreationToCollection"
  | "avgCollectionToDelivery"
  | "avgCreationToDelivery"
  | "collectionSlaRate"
  | "deliverySlaRate";

const fmtH = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}h`);
const fmtPct = (v: number | null) => (v === null ? "—" : `${v.toFixed(0)}%`);

const PerformanceLeaderboard = ({ orders, range }: Props) => {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("avgCreationToDelivery");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<string | null>(null);

  const rows = useMemo(() => getPerformanceLeaderboard(orders, range, 3), [orders, range]);

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? rows.filter(r => r.customerName.toLowerCase().includes(q)) : rows;
    const sortFn = (a: PerformanceLeaderboardRow, b: PerformanceLeaderboardRow) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // nulls always last
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    };
    return [...filtered].sort(sortFn).slice(0, 20);
  }, [rows, query, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const TH = ({ k, children, align = "right" }: { k: SortKey; children: React.ReactNode; align?: "left" | "right" }) => (
    <th
      onClick={() => toggleSort(k)}
      className={cn(
        "px-3 py-2 cursor-pointer select-none whitespace-nowrap",
        align === "right" ? "text-right" : "text-left",
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
            <CardTitle>Slowest Customers</CardTitle>
            <CardDescription>
              Sortable performance leaderboard for the selected period. Rows with SLA &lt; 75% are highlighted.
              Customers with fewer than 3 completed orders are excluded.
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer…" className="pl-8" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[32rem] rounded-md border">
          <div className="min-w-[860px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                <tr className="text-muted-foreground">
                  <th className="px-3 py-2 text-left">Customer</th>
                  <TH k="orders">Orders</TH>
                  <TH k="avgCreationToCollection">Created → Collected</TH>
                  <TH k="avgCollectionToDelivery">Collected → Delivered</TH>
                  <TH k="avgCreationToDelivery">Total</TH>
                  <TH k="collectionSlaRate">Coll SLA</TH>
                  <TH k="deliverySlaRate">Del SLA</TH>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                      No customers with enough completed orders in this period.
                    </td>
                  </tr>
                ) : (
                  sorted.map((r) => {
                    const breached =
                      (r.collectionSlaRate !== null && r.collectionSlaRate < 75) ||
                      (r.deliverySlaRate !== null && r.deliverySlaRate < 75);
                    return (
                      <tr
                        key={r.customerName}
                        onClick={() => setSelected(r.customerName)}
                        className={cn(
                          "cursor-pointer border-t border-border transition-colors hover:bg-accent/50",
                          breached && "bg-destructive/5",
                        )}
                      >
                        <td className="px-3 py-2 font-medium">
                          <div className="flex items-center gap-2">
                            <span>{r.customerName}</span>
                            {r.isB2B && <Badge variant="secondary" className="text-[10px]">B2B</Badge>}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">{r.orders}</td>
                        <td className="px-3 py-2 text-right">{fmtH(r.avgCreationToCollection)}</td>
                        <td className="px-3 py-2 text-right">{fmtH(r.avgCollectionToDelivery)}</td>
                        <td className="px-3 py-2 text-right font-medium">{fmtH(r.avgCreationToDelivery)}</td>
                        <td className={cn("px-3 py-2 text-right", r.collectionSlaRate !== null && r.collectionSlaRate < 75 && "text-destructive font-medium")}>
                          {fmtPct(r.collectionSlaRate)}
                        </td>
                        <td className={cn("px-3 py-2 text-right", r.deliverySlaRate !== null && r.deliverySlaRate < 75 && "text-destructive font-medium")}>
                          {fmtPct(r.deliverySlaRate)}
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

      <CustomerOrdersDialog
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        customerName={selected}
        orders={orders}
      />
    </Card>
  );
};

export default PerformanceLeaderboard;
