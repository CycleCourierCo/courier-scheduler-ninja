import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function calculateLabourPrice(minutes: number, hourlyRate: number, minCharge: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return minCharge;
  const raw = (minutes * hourlyRate) / 60;
  const rounded = Math.ceil(raw / 5) * 5;
  return Math.max(minCharge, rounded);
}

export function formatGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export interface WorkshopSettings {
  hourly_rate_gbp: number;
  min_charge_gbp: number;
}

const DEFAULT_SETTINGS: WorkshopSettings = { hourly_rate_gbp: 75, min_charge_gbp: 15 };

export function useWorkshopSettings() {
  return useQuery({
    queryKey: ["workshop_settings"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<WorkshopSettings> => {
      const { data, error } = await supabase
        .from("workshop_settings")
        .select("hourly_rate_gbp,min_charge_gbp")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_SETTINGS;
      return {
        hourly_rate_gbp: Number(data.hourly_rate_gbp),
        min_charge_gbp: Number(data.min_charge_gbp),
      };
    },
  });
}

export function useUpdateWorkshopSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: WorkshopSettings) => {
      const { error } = await supabase
        .from("workshop_settings")
        .update({
          hourly_rate_gbp: settings.hourly_rate_gbp,
          min_charge_gbp: settings.min_charge_gbp,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workshop_settings"] });
    },
  });
}
