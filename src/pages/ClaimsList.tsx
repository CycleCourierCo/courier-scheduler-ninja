import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, ShieldAlert } from "lucide-react";
import ClaimStatusBadge from "@/components/claims/ClaimStatusBadge";
import {
  CLAIM_STATUSES,
  DAMAGE_TYPES,
  getClaimsStats,
  listClaims,
  type Claim,
  type ClaimStatus,
  type ClaimsStats,
} from "@/services/claimsService";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const FILTER_CHIPS: { value: ClaimStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  ...CLAIM_STATUSES.map((s) => ({ value: s.value, label: s.label })),
];

const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : `£${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const damageLabel = (v: string | null) => DAMAGE_TYPES.find((d) => d.value === v)?.label ?? "—";

const ClaimsList = () => {
  const navigate = useNavigate();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [stats, setStats] = useState<ClaimsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | "all">("all");

  const load = async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([listClaims({ status: statusFilter, search }), getClaimsStats()]);
      setClaims(c);
      setStats(s);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return claims;
    const s = search.trim().toLowerCase();
    return claims.filter((c) =>
      [c.claim_ref, c.booking_ref, c.customer_name, c.bike_make_model]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(s)),
    );
  }, [claims, search]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold">Damage Claims</h1>
          </div>
          <Button asChild className="bg-green-600 hover:bg-green-700 text-white">
            <Link to="/claims/new">
              <Plus className="h-4 w-4 mr-2" /> New Claim
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Open Claims</div>
            <div className="text-2xl font-bold">{stats?.open ?? "—"}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Awaiting Response</div>
            <div className="text-2xl font-bold">{stats?.awaitingInfo ?? "—"}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Settled This Month</div>
            <div className="text-2xl font-bold">{fmtMoney(stats?.settledThisMonthAmount ?? 0)}</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Avg Days to Resolution</div>
            <div className="text-2xl font-bold">{stats?.avgDaysToResolution ?? "—"}</div>
          </CardContent></Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search booking ref, customer, bike…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2">
          {FILTER_CHIPS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={statusFilter === f.value ? "default" : "outline"}
              onClick={() => setStatusFilter(f.value)}
              className={cn(statusFilter === f.value && "bg-primary")}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim ID</TableHead>
                  <TableHead>Booking Ref</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Bike</TableHead>
                  <TableHead>Damage Type</TableHead>
                  <TableHead>Date Opened</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Settlement £</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                )}
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No claims found.</TableCell></TableRow>
                )}
                {!loading && filtered.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/claims/${c.id}`)}
                  >
                    <TableCell className="font-mono text-sm">{c.claim_ref}</TableCell>
                    <TableCell>{c.booking_ref}</TableCell>
                    <TableCell>{c.customer_name ?? "—"}</TableCell>
                    <TableCell>{c.bike_make_model ?? "—"}</TableCell>
                    <TableCell>{damageLabel(c.damage_type)}</TableCell>
                    <TableCell>{format(new Date(c.created_at), "dd MMM yyyy")}</TableCell>
                    <TableCell><ClaimStatusBadge status={c.status} /></TableCell>
                    <TableCell>{fmtMoney(c.offer_amount)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/claims/${c.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ClaimsList;
