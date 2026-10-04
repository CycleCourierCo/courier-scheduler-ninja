import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getMonthlyReconciliation } from "@/services/profitabilityService";

const gbp = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`;

const RevenueReconciliationCard = ({ year }: { year: number }) => {
  const { data = [], isLoading } = useQuery({
    queryKey: ["profitability-reconciliation", year],
    queryFn: () => getMonthlyReconciliation(year),
    staleTime: 10 * 60 * 1000,
  });

  const total = data.reduce(
    (t, r) => ({
      page: t.page + r.pageRevenue,
      inv: t.inv + r.invoicedOnPage,
      est: t.est + r.estimatedOnPage,
      jobs: t.jobs + r.estimatedJobs,
      shop: t.shop + r.shopifyOnPage,
      shopJobs: t.shopJobs + r.shopifyJobs,
      qb: t.qb + r.invoicedTransport,
    }),
    { page: 0, inv: 0, est: 0, jobs: 0, shop: 0, shopJobs: 0, qb: 0 }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue check against invoices ({year})</CardTitle>
        <CardDescription>
          All figures exclude VAT. Page revenue uses the real invoiced delivery amount for each job where
          one is linked, and an estimate otherwise. Website (Shopify) orders are paid at checkout, so they
          never have an invoice — they're shown separately, not as missing invoices. QuickBooks column is
          all collection and delivery invoiced that month. Repairs, storage and other extras are left out.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Working this out…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">On this page</TableHead>
                <TableHead className="text-right">From invoices</TableHead>
                <TableHead className="text-right">Estimated</TableHead>
                <TableHead className="text-right">Invoiced in QuickBooks</TableHead>
                <TableHead className="text-right">Not on a timeslip</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.month}>
                  <TableCell>{r.month}</TableCell>
                  <TableCell className="text-right">{gbp(r.pageRevenue)}</TableCell>
                  <TableCell className="text-right">{gbp(r.invoicedOnPage)}</TableCell>
                  <TableCell className="text-right">
                    {gbp(r.estimatedOnPage)}
                    {r.estimatedJobs > 0 && <span className="text-muted-foreground"> ({r.estimatedJobs} jobs)</span>}
                  </TableCell>
                  <TableCell className="text-right">{gbp(r.invoicedTransport)}</TableCell>
                  <TableCell className="text-right">{gbp(Math.max(0, r.invoicedTransport - r.invoicedOnPage))}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{gbp(total.page)}</TableCell>
                <TableCell className="text-right">{gbp(total.inv)}</TableCell>
                <TableCell className="text-right">{gbp(total.est)} ({total.jobs} jobs)</TableCell>
                <TableCell className="text-right">{gbp(total.qb)}</TableCell>
                <TableCell className="text-right">{gbp(Math.max(0, total.qb - total.inv))}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Invoice amounts fill in after an admin presses "Sync order invoice links" on the Invoices page.
        </p>
      </CardContent>
    </Card>
  );
};

export default RevenueReconciliationCard;
