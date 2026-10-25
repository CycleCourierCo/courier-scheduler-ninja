import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { suggestSavedRoute } from "@/lib/fleet/routeReport";

interface Props {
  date: string; // YYYY-MM-DD
  value: string | null;
  onChange: (id: string | null) => void;
  timeslipId?: string;
  /** Order ids on the timeslip, used to suggest the matching saved route. */
  orderIds?: string[];
  required?: boolean;
}

/** Pick which saved route (from Route Builder) this timeslip ran. */
export default function SavedRoutePicker({ date, value, onChange, timeslipId, orderIds = [], required }: Props) {
  const { data } = useQuery({
    queryKey: ["saved-routes-for-date", date],
    enabled: !!date,
    queryFn: async () => {
      const [routes, used] = await Promise.all([
        supabase.from("saved_routes").select("id, name, start_time, job_data").like("name", `${date}%`).order("created_at"),
        (supabase as any).from("timeslips").select("id, saved_route_id").eq("date", date).not("saved_route_id", "is", null),
      ]);
      if (routes.error) throw routes.error;
      return { routes: routes.data ?? [], used: (used.data ?? []) as { id: string; saved_route_id: string }[] };
    },
  });

  const options = useMemo(() => {
    const takenBy = new Map((data?.used ?? []).map((u) => [u.saved_route_id, u.id]));
    return (data?.routes ?? []).filter((r) => r.id === value || !takenBy.has(r.id) || takenBy.get(r.id) === timeslipId);
  }, [data, value, timeslipId]);

  const suggested = useMemo(
    () => suggestSavedRoute(orderIds, options.map((o) => ({ id: o.id, stops: (o.job_data as any[]) ?? [] }))),
    [orderIds, options],
  );

  useEffect(() => {
    if (!value && suggested) onChange(suggested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggested]);

  return (
    <div className="space-y-2">
      <Label>Saved route{required ? " *" : ""}</Label>
      <Select value={value ?? "none"} onValueChange={(v) => onChange(v === "none" ? null : v)}>
        <SelectTrigger><SelectValue placeholder="Pick the planned route" /></SelectTrigger>
        <SelectContent>
          {!required && <SelectItem value="none">No saved route</SelectItem>}
          {options.map((r) => {
            const n = Array.isArray(r.job_data) ? r.job_data.length : 0;
            return (
              <SelectItem key={r.id} value={r.id}>
                {r.name} · {n} stops{r.start_time ? ` · ${r.start_time}` : ""}{r.id === suggested ? " (match)" : ""}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {options.length === 0 && <p className="text-xs text-muted-foreground">No unused saved routes for this date.</p>}
    </div>
  );
}
