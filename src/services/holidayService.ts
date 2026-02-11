import { supabase } from "@/integrations/supabase/client";

export interface Holiday {
  id: string;
  date: string;
  name: string;
  created_by: string | null;
  created_at: string;
}

export const fetchHolidays = async (): Promise<Holiday[]> => {
  const { data, error } = await supabase
    .from("holidays")
    .select("*")
    .order("date", { ascending: true });

  if (error) {
    console.error("Error fetching holidays:", error);
    throw error;
  }

  return data || [];
};

export const fetchHolidayDates = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from("holidays")
    .select("date");

  if (error) {
    console.error("Error fetching holiday dates:", error);
    return [];
  }

  return (data || []).map((h) => h.date);
};

export const addHoliday = async (date: string, name: string): Promise<Holiday> => {
  const { data, error } = await supabase
    .from("holidays")
    .insert({ date, name })
    .select()
    .single();

  if (error) {
    console.error("Error adding holiday:", error);
    throw error;
  }

  return data;
};

export const deleteHoliday = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("holidays")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting holiday:", error);
    throw error;
  }
};
