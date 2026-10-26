import { useQueries } from "@tanstack/react-query";
import * as Sentry from "@sentry/react";
import { supabase } from "@/integrations/supabase/client";
import type { RouteAnalysis, StopEtaView } from "@/components/fleet/RouteOverlay";

export interface RouteEtas { byStop: Map<number, StopEtaView>; unavailable: boolean; loading: boolean }

/** Live ETAs (Radius position → each unvisited stop, +15 min per earlier stop), one call per route. */
export function useStopEtas(analyses: RouteAnalysis[], enabled: boolean) {
  const targets = analyses.map((a) => {
    const remaining = a.stops.map((s, i) => ({ s, i })).filter(({ s }) => !s.visitedAt && !s.completed).slice(0, 26);
    return { a, remaining, ok: enabled && a.hasVan && remaining.length > 0 };
  });
  const results = useQueries({
    queries: targets.map(({ a, remaining, ok }) => ({
      queryKey: ["stop-etas", a.key, a.registration, remaining.map((r) => r.i).join(",")],
      enabled: ok,
      refetchInterval: 120_000,
      retry: 1,
      queryFn: async () => {
        const { data, error } = await supabase.functions.invoke("eta-link", {
          body: { action: "route_etas", registration: a.registration, stops: remaining.map(({ s }) => ({ lat: s.lat, lon: s.lon })) },
        });
        if (error) { Sentry.captureException(error, { tags: { feature: "live-map-stop-etas" } }); throw error; }
        return data as { etas?: StopEtaView[]; unavailable?: boolean };
      },
    })),
  });
  const out = new Map<string, RouteEtas>();
  targets.forEach(({ a, remaining, ok }, k) => {
    if (!ok) return;
    const q = results[k];
    const byStop = new Map<number, StopEtaView>();
    (q.data?.etas ?? []).forEach((e, j) => remaining[j] && byStop.set(remaining[j].i, e));
    out.set(a.key, { byStop, unavailable: !!q.data?.unavailable || q.isError, loading: q.isLoading });
  });
  return out;
}
