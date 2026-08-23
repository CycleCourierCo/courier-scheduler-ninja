import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Site = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  postcode: string | null;
  lat: number | null;
  lon: number | null;
  is_default: boolean;
  is_active: boolean;
  display_order: number;
};

export const DEFAULT_SITE_CODE = "BHM";
export const SCOTLAND_SITE_CODE = "SCO";

export function useSites(includeInactive = false) {
  return useQuery({
    queryKey: ["sites", includeInactive],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Site[]> => {
      let query = (supabase.from("sites" as any) as any)
        .select("*")
        .order("display_order", { ascending: true });
      if (!includeInactive) query = query.eq("is_active", true);
      const { data, error } = await query;
      if (error) throw error;
      return (data as Site[]) || [];
    },
  });
}

export function findSite(sites: Site[] | undefined, code: string): Site | undefined {
  return sites?.find((s) => s.code === code);
}

export function defaultSite(sites: Site[] | undefined): Site | undefined {
  return sites?.find((s) => s.is_default) || sites?.[0];
}

/** Site coordinates, falling back to the Birmingham depot constants. */
export function siteCoords(site?: Site | null): { lat: number; lon: number } | null {
  if (site?.lat != null && site?.lon != null) return { lat: site.lat, lon: site.lon };
  return null;
}
