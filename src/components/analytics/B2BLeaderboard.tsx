import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CustomerOrderCount } from "@/services/analyticsService";
import { Order } from "@/types/order";
import CustomerOrdersDialog from "./CustomerOrdersDialog";
import { Search } from "lucide-react";

interface B2BLeaderboardProps {
  customers: CustomerOrderCount[];
  orders: Order[];
}

const B2BLeaderboard = ({ customers, orders }: B2BLeaderboardProps) => {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      c.customerName.toLowerCase().includes(q)
    );
  }, [customers, query]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>B2B Customer Leaderboard</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customer..."
              className="pl-8"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[28rem] rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
              <tr className="text-left">
                <th className="px-3 py-2 w-16">Rank</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2 w-32 text-right">Orders</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    No customers found.
                  </td>
                </tr>
              ) : (
                filtered.map((c, idx) => {
                  // Rank against original (unfiltered) ordering
                  const rank =
                    customers.findIndex(
                      (x) => x.customerName === c.customerName
                    ) + 1;
                  return (
                    <tr
                      key={c.customerName}
                      onClick={() => setSelected(c.customerName)}
                      className="cursor-pointer border-t border-border transition-colors hover:bg-accent/50"
                    >
                      <td className="px-3 py-2 font-medium text-muted-foreground">
                        #{rank}
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {c.customerName}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Badge variant="secondary">{c.count}</Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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

export default B2BLeaderboard;
