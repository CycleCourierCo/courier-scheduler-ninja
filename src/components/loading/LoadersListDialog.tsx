import { useCallback, useEffect, useMemo, useState } from "react";
import { format, startOfDay, endOfDay } from "date-fns";
import { CalendarIcon, Loader2, Truck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { getCollectionPhotos } from "@/utils/collectionPhotos";
import { normaliseDriverName } from "@/utils/driverAssignmentUtils";
import { groupLoadersList } from "@/lib/loadersList";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface Row {
  id: string; ref: string; driver: string | null; brand: string; model: string; customer: string; sender: string;
  photo?: string; bay: string; takenOut: boolean; takenOutAt: string | null; takenOutBy: string | null;
}

const bayText = (locs: any): string =>
  Array.isArray(locs) && locs.length
    ? locs.map((l: any) => `${l.bay ?? ""}${l.position ?? ""}`).filter(Boolean).join(", ")
    : "";

export function LoadersListDialog({ isAdmin, onChanged }: { isAdmin: boolean; onChanged?: () => void }) {
  const [date, setDate] = useState<Date>(new Date());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [calOpen, setCalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const from = startOfDay(date).toISOString(), to = endOfDay(date).toISOString();
    const { data, error } = await (supabase as any).from("orders")
      .select("id, tracking_number, delivery_driver_name, bike_brand, bike_model, sender, receiver, tracking_events, shipday_pickup_id, storage_locations, loaded_from_locations, loaded_onto_van, loaded_onto_van_at, loaded_onto_van_by_name")
      .gte("scheduled_delivery_date", from).lte("scheduled_delivery_date", to)
      .not("status", "in", "(cancelled)")
      .or(`storage_locations.not.is.null,and(loaded_onto_van.eq.true,loaded_onto_van_at.gte.${from},loaded_onto_van_at.lte.${to})`);
    setLoading(false);
    if (error) { toast.error("Couldn't load the loaders list"); return; }
    setRows((data ?? []).filter((d: any) => d.loaded_onto_van || bayText(d.storage_locations)).map((d: any) => ({
      id: d.id, ref: d.tracking_number ?? "", driver: normaliseDriverName(d.delivery_driver_name) || null,
      brand: d.bike_brand ?? "", model: d.bike_model ?? "", customer: d.receiver?.name ?? "", sender: d.sender?.name ?? "",
      photo: getCollectionPhotos(d.tracking_events, d.shipday_pickup_id ?? null)[0],
      bay: d.loaded_onto_van ? bayText(d.loaded_from_locations) : bayText(d.storage_locations),
      takenOut: !!d.loaded_onto_van, takenOutAt: d.loaded_onto_van_at, takenOutBy: d.loaded_onto_van_by_name,
    })));
  }, [date]);

  useEffect(() => { load(); }, [load]);
  const groups = useMemo(() => groupLoadersList(rows), [rows]);

  const takeOut = async (id: string) => {
    setBusy(id);
    const { error } = await (supabase as any).rpc("load_orders_onto_van", { p_order_ids: [id] });
    setBusy(null);
    if (error) return toast.error("Couldn't mark as taken out — nothing was saved");
    toast.success("Marked as taken out of depot");
    await load(); onChanged?.();
  };
  const undo = async (id: string) => {
    setBusy(id);
    const { error } = await (supabase as any).rpc("undo_taken_out", { p_order_id: id });
    setBusy(null);
    if (error) return toast.error("Couldn't undo");
    toast.success("Put back in its bay");
    await load(); onChanged?.();
  };

  return (
    <div className="space-y-4">
      <Popover open={calOpen} onOpenChange={setCalOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start">
            <CalendarIcon className="mr-2 h-4 w-4" />{format(date, "EEEE d MMMM yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={(d) => { if (d) { setDate(d); setCalOpen(false); } }} className="pointer-events-auto" />
        </PopoverContent>
      </Popover>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No bikes in the depot booked out for this day.</p>
      ) : (
      <Accordion type="multiple" className="space-y-2">
      {groups.map((g) => (
        <AccordionItem key={g.driver} value={g.driver} className="rounded-md border">
          <AccordionTrigger className="bg-muted/50 px-3 py-3 hover:no-underline">
            <span className="flex flex-1 flex-wrap items-center justify-between gap-2 pr-2">
              <span className="flex items-center gap-2 text-lg font-semibold"><Truck className="h-5 w-5" />{g.driver}</span>
              <Badge variant={g.takenOut === g.bikes.length ? "default" : "outline"}>{g.takenOut} of {g.bikes.length} taken out</Badge>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-0">
          <ul className="divide-y">
            {g.bikes.map((b) => (
              <li key={b.id} className={cn("flex gap-3 p-3", b.takenOut && "opacity-60")}>
                {b.photo ? (
                  <a href={b.photo} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <img src={b.photo} alt="Bike" className="h-20 w-20 rounded-md object-cover" loading="lazy" />
                  </a>
                ) : <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md bg-muted text-center text-[10px] text-muted-foreground">No photo</div>}
                <div className="min-w-0 flex-1 space-y-0.5 text-sm">
                  <p className="font-medium">{[b.brand, b.model].filter(Boolean).join(" ") || "Bike"}</p>
                  <p className="text-muted-foreground">Customer: {b.customer || "—"}{b.sender ? ` (from ${b.sender})` : ""}</p>
                  <p className="font-mono text-xs">{b.ref}</p>
                  <p>Location: <span className="font-medium">{b.bay || "—"}</span></p>
                  {b.takenOut ? (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Badge variant="secondary">
                        Taken out by {b.takenOutBy || "staff"}{b.takenOutAt ? ` at ${format(new Date(b.takenOutAt), "HH:mm")}` : ""}
                      </Badge>
                      {isAdmin && (
                        <Button size="sm" variant="ghost" disabled={busy === b.id} onClick={() => undo(b.id)}>
                          <Undo2 className="mr-1 h-3 w-3" />Undo
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Button size="sm" className="mt-1" disabled={busy === b.id} onClick={() => takeOut(b.id)}>
                      {busy === b.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Truck className="mr-1 h-3 w-3" />}
                      Taken out of depot
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          </AccordionContent>
        </AccordionItem>
      ))}
      </Accordion>
      )}
    </div>
  );
}
