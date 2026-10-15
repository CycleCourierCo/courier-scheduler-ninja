import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { addDays, format, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Download, RefreshCw, ExternalLink, Loader2 } from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { CLEAN_AIR_ZONES } from "@/data/cleanAirZones";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const db = supabase as any;
const ymd = (d: Date) => format(d, "yyyy-MM-dd");
const zoneName = (slug: string) => CLEAN_AIR_ZONES.find((z) => z.slug === slug)?.name ?? slug;

const CleanAirZonesPage = () => {
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [checkDate, setCheckDate] = useState(() => ymd(addDays(new Date(), -1)));
  const [checking, setChecking] = useState(false);
  const from = ymd(weekStart), to = ymd(addDays(weekStart, 6));

  const zonesQ = useQuery({
    queryKey: ["caz-zones"],
    queryFn: async () => (await db.from("clean_air_zones").select("*").order("name")).data || [],
  });
  const vehiclesQ = useQuery({
    queryKey: ["caz-vehicles"],
    queryFn: async () => {
      const [{ data: v }, { data: e }] = await Promise.all([
        db.from("vehicles").select("id, registration, make, status").order("registration"),
        db.from("caz_vehicle_exemptions").select("vehicle_id, zone_slug"),
      ]);
      return { vehicles: v || [], exempt: new Set((e || []).map((x: any) => `${x.vehicle_id}:${x.zone_slug}`)) };
    },
  });
  const chargesQ = useQuery({
    queryKey: ["caz-charges", from],
    queryFn: async () => {
      const { data, error } = await db.from("caz_charges").select("*").gte("date", from).lte("date", to).order("date");
      if (error) throw error;
      const ids = [...new Set((data || []).map((r: any) => r.driver_id).filter(Boolean))];
      const { data: profs } = ids.length ? await db.from("profiles").select("id, name, email").in("id", ids) : { data: [] };
      const names = new Map((profs || []).map((p: any) => [p.id, p.name || p.email]));
      return (data || []).map((r: any) => ({ ...r, driverName: names.get(r.driver_id) || "Unknown" }));
    },
  });

  const vehicleReg = (id: string | null) => vehiclesQ.data?.vehicles.find((v: any) => v.id === id)?.registration || "—";
  const charges = chargesQ.data || [];
  const totals = useMemo(() => {
    const byZone = new Map<string, number>(), byDriver = new Map<string, number>();
    let unpaid = 0;
    for (const c of charges) {
      byZone.set(c.zone_slug, (byZone.get(c.zone_slug) || 0) + Number(c.charge));
      byDriver.set(c.driverName, (byDriver.get(c.driverName) || 0) + Number(c.charge));
      if (!c.paid_at && Number(c.charge) > 0) unpaid += Number(c.charge);
    }
    return { byZone, byDriver, unpaid };
  }, [charges]);

  const togglePaid = async (c: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await db.from("caz_charges")
      .update(c.paid_at ? { paid_at: null, paid_by: null } : { paid_at: new Date().toISOString(), paid_by: user?.id })
      .eq("id", c.id);
    if (error) return toast.error("Couldn't update");
    qc.invalidateQueries({ queryKey: ["caz-charges"] });
  };

  const saveCharge = async (slug: string, value: string) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return toast.error("Enter a valid amount");
    const { error } = await db.from("clean_air_zones").update({ daily_charge: n, updated_at: new Date().toISOString() }).eq("slug", slug);
    if (error) return toast.error("Couldn't save");
    toast.success("Charge saved — applies to future checks");
    qc.invalidateQueries({ queryKey: ["caz-zones"] });
  };

  const toggleExempt = async (vehicleId: string, slug: string, on: boolean) => {
    const q = on
      ? db.from("caz_vehicle_exemptions").insert({ vehicle_id: vehicleId, zone_slug: slug })
      : db.from("caz_vehicle_exemptions").delete().eq("vehicle_id", vehicleId).eq("zone_slug", slug);
    const { error } = await q;
    if (error) return toast.error("Couldn't update");
    qc.invalidateQueries({ queryKey: ["caz-vehicles"] });
  };

  // Bulk set exemptions for a set of vans × zones in one go
  const setExemptBulk = async (vehicleIds: string[], slugs: string[], on: boolean) => {
    if (!vehicleIds.length || !slugs.length) return;
    const exempt = vehiclesQ.data?.exempt ?? new Set<string>();
    let error: any = null;
    if (on) {
      const rows = vehicleIds.flatMap((v) => slugs.filter((s) => !exempt.has(`${v}:${s}`)).map((s) => ({ vehicle_id: v, zone_slug: s })));
      if (rows.length) ({ error } = await db.from("caz_vehicle_exemptions").insert(rows));
    } else {
      ({ error } = await db.from("caz_vehicle_exemptions").delete().in("vehicle_id", vehicleIds).in("zone_slug", slugs));
    }
    if (error) return toast.error("Couldn't update");
    qc.invalidateQueries({ queryKey: ["caz-vehicles"] });
  };
  const allSlugs = CLEAN_AIR_ZONES.map((z) => z.slug);
  const allVanIds = (vehiclesQ.data?.vehicles || []).map((v: any) => v.id);
  const isAll = (vIds: string[], slugs: string[]) =>
    vIds.length > 0 && vIds.every((v) => slugs.every((s) => vehiclesQ.data?.exempt.has(`${v}:${s}`)));

  const runCheck = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("caz-daily-check", { body: { date: checkDate } });
      if (error) throw error;
      toast.success(`${data.date}: ${data.checked} routes checked, ${data.found} zone entries${data.failed ? `, ${data.failed} failed` : ""}`);
      qc.invalidateQueries({ queryKey: ["caz-charges"] });
    } catch {
      toast.error("Check failed — try again");
    } finally {
      setChecking(false);
    }
  };

  const exportCsv = () => {
    const rows = [["Date", "Driver", "Van", "Zone", "Charge", "Status"],
      ...charges.map((c: any) => [c.date, c.driverName, vehicleReg(c.vehicle_id), zoneName(c.zone_slug), Number(c.charge).toFixed(2),
        c.exempt ? "Exempt" : c.paid_at ? "Paid" : Number(c.charge) > 0 ? "Unpaid" : "No charge"])];
    const blob = new Blob([rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `clean-air-zones-${from}.csv`;
    a.click();
  };

  const geo = useMemo(() => CLEAN_AIR_ZONES.map((z) => ({
    slug: z.slug, name: z.name,
    data: { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: z.polygons } } as any,
  })), []);

  return (
    <Layout>
      <div className="space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-bold">Clean Air Zones</h1>
          <p className="text-muted-foreground text-sm">Each morning yesterday's timeslip routes are checked against these zones so charges can be paid.</p>
        </div>

        <Tabs defaultValue="week">
          <TabsList>
            <TabsTrigger value="week">Weekly charges</TabsTrigger>
            <TabsTrigger value="zones">Zones</TabsTrigger>
            <TabsTrigger value="vans">Van exemptions</TabsTrigger>
          </TabsList>

          <TabsContent value="week" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base sm:text-lg">Week of {format(weekStart, "d MMM yyyy")}</CardTitle>
                  <CardDescription>Unpaid this week: £{totals.unpaid.toFixed(2)}</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></Button>
                  <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week"><ChevronRight className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" onClick={exportCsv} disabled={!charges.length}><Download className="h-4 w-4 mr-1" />CSV</Button>
                  <Input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)} className="w-40 h-9" />
                  <Button size="sm" onClick={runCheck} disabled={checking}>
                    {checking ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                    {checking ? "Checking…" : "Re-check day"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {chargesQ.isLoading ? <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
                  : !charges.length ? <div className="py-8 text-center text-sm text-muted-foreground">No zone entries this week</div>
                  : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead>Day</TableHead><TableHead>Driver</TableHead><TableHead>Van</TableHead>
                          <TableHead>Zone</TableHead><TableHead className="text-right">Charge</TableHead><TableHead>Paid</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {charges.map((c: any) => {
                            const due = !c.exempt && Number(c.charge) > 0;
                            return (
                              <TableRow key={c.id} className={due && !c.paid_at ? "bg-destructive/5" : ""}>
                                <TableCell className="whitespace-nowrap">{format(new Date(`${c.date}T00:00:00`), "EEE d MMM")}</TableCell>
                                <TableCell>{c.driverName}</TableCell>
                                <TableCell>{vehicleReg(c.vehicle_id)}</TableCell>
                                <TableCell>{zoneName(c.zone_slug)}</TableCell>
                                <TableCell className="text-right">£{Number(c.charge).toFixed(2)}</TableCell>
                                <TableCell>
                                  {c.exempt ? <Badge variant="secondary">Exempt</Badge>
                                    : !due ? <Badge variant="secondary">No charge</Badge>
                                    : <label className="flex items-center gap-2 text-sm">
                                        <Checkbox checked={!!c.paid_at} onCheckedChange={() => togglePaid(c)} />
                                        {c.paid_at ? `Paid ${format(new Date(c.paid_at), "d MMM")}` : <span className="text-destructive font-medium">Unpaid</span>}
                                      </label>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
              </CardContent>
            </Card>
            {!!charges.length && (
              <div className="grid gap-4 sm:grid-cols-2">
                {[["By zone", [...totals.byZone].map(([k, v]) => [zoneName(k), v])], ["By driver", [...totals.byDriver]]].map(([title, list]: any) => (
                  <Card key={title}>
                    <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      {list.map(([k, v]: any) => <div key={k} className="flex justify-between"><span>{k}</span><span className="font-medium">£{v.toFixed(2)}</span></div>)}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="zones" className="space-y-4">
            <Card>
              <CardContent className="p-0 overflow-hidden rounded-lg">
                <MapContainer center={[52.8, -1.9]} zoom={6} style={{ height: 420 }} scrollWheelZoom>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                  {geo.map((g) => (
                    <GeoJSON key={g.slug} data={g.data} style={() => ({ color: "hsl(var(--primary))", weight: 2, fillOpacity: 0.25 })}
                      onEachFeature={(_f: any, layer: any) => layer.bindTooltip(g.name, { sticky: true })} />
                  ))}
                </MapContainer>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Zone</TableHead><TableHead>Daily van charge (£)</TableHead><TableHead>Pay</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(zonesQ.data || []).map((z: any) => (
                      <TableRow key={z.slug}>
                        <TableCell className="font-medium">{z.name}</TableCell>
                        <TableCell>
                          <Input type="number" step="0.01" min="0" defaultValue={z.daily_charge} className="w-28 h-8"
                            onBlur={(e) => Number(e.target.value) !== Number(z.daily_charge) && saveCharge(z.slug, e.target.value)} />
                        </TableCell>
                        <TableCell>
                          {z.pay_url && <a href={z.pay_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary text-sm underline">Pay <ExternalLink className="h-3 w-3" /></a>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vans">
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-base">Compliant vans</CardTitle>
                  <CardDescription>Tick a zone where a van isn't charged. Its trips still show, as "Exempt".</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setExemptBulk(allVanIds, allSlugs, !isAll(allVanIds, allSlugs))}>
                  {isAll(allVanIds, allSlugs) ? "Untick all" : "Tick all"}
                </Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Van</TableHead>
                    <TableHead className="text-center whitespace-nowrap">All zones</TableHead>
                    {CLEAN_AIR_ZONES.map((z) => {
                      const all = isAll(allVanIds, [z.slug]);
                      return (
                        <TableHead key={z.slug} className="text-center whitespace-nowrap">
                          <div className="flex flex-col items-center gap-1 py-1">
                            <span>{z.name.split(" (")[0]}</span>
                            <Checkbox aria-label={`Tick all vans for ${z.name}`} checked={all} onCheckedChange={() => setExemptBulk(allVanIds, [z.slug], !all)} />
                          </div>
                        </TableHead>
                      );
                    })}
                  </TableRow></TableHeader>
                  <TableBody>
                    {(vehiclesQ.data?.vehicles || []).map((v: any) => {
                      const rowAll = isAll([v.id], allSlugs);
                      return (
                      <TableRow key={v.id}>
                        <TableCell className="whitespace-nowrap font-medium">{v.registration}{v.make ? ` · ${v.make}` : ""}</TableCell>
                        <TableCell className="text-center"><Checkbox aria-label={`All zones for ${v.registration}`} checked={rowAll} onCheckedChange={() => setExemptBulk([v.id], allSlugs, !rowAll)} /></TableCell>
                        {CLEAN_AIR_ZONES.map((z) => {
                          const on = vehiclesQ.data!.exempt.has(`${v.id}:${z.slug}`);
                          return <TableCell key={z.slug} className="text-center"><Checkbox checked={on} onCheckedChange={() => toggleExempt(v.id, z.slug, !on)} /></TableCell>;
                        })}
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default CleanAirZonesPage;
