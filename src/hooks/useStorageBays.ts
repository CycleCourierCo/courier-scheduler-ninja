import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type StorageBay = {
  id: string;
  label: string;
  position_count: number;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export const useStorageBays = (includeInactive = false) => {
  const [bays, setBays] = useState<StorageBay[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    let query = (supabase.from("storage_bays" as any) as any)
      .select("*")
      .order("display_order", { ascending: true });
    if (!includeInactive) query = query.eq("is_active", true);
    const { data, error } = await query;
    if (!error) setBays((data as StorageBay[]) || []);
    setLoading(false);
  }, [includeInactive]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { bays, loading, refresh };
};

export const getBayMaxPosition = (bays: StorageBay[], label: string): number | null => {
  const bay = bays.find((b) => b.label.toUpperCase() === label.toUpperCase());
  return bay ? bay.position_count : null;
};
