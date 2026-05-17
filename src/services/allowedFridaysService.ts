import { supabase } from "@/integrations/supabase/client";

export interface AllowedFriday {
  id: string;
  date: string;
  name: string;
  created_by: string | null;
  created_at: string;
}

export const fetchAllowedFridays = async (): Promise<AllowedFriday[]> => {
  const { data, error } = await supabase
    .from("allowed_fridays")
    .select("*")
    .order("date", { ascending: true });
  if (error) {
    console.error("Error fetching allowed Fridays:", error);
    throw error;
  }
  return data || [];
};

export const fetchAllowedFridayDates = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from("allowed_fridays")
    .select("date");
  if (error) {
    console.error("Error fetching allowed Friday dates:", error);
    return [];
  }
  return (data || []).map((d) => d.date);
};

export const addAllowedFriday = async (date: string, name: string): Promise<AllowedFriday> => {
  const { data, error } = await supabase
    .from("allowed_fridays")
    .insert({ date, name })
    .select()
    .single();
  if (error) {
    console.error("Error adding allowed Friday:", error);
    throw error;
  }
  return data;
};

export const deleteAllowedFriday = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("allowed_fridays")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("Error deleting allowed Friday:", error);
    throw error;
  }
};
