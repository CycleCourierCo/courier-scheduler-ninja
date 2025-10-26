import { supabase } from "@/integrations/supabase/client";
import { Driver } from "@/types/timeslip";

export const driverService = {
  async getAllDrivers() {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) throw error;
    return data as Driver[];
  },

  async updateDriver(id: string, updates: Partial<Driver>) {
    const { data, error } = await supabase
      .from('drivers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Driver;
  },

  async createDriver(driver: Omit<Driver, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('drivers')
      .insert(driver)
      .select()
      .single();
    
    if (error) throw error;
    return data as Driver;
  },

  async deleteDriver(id: string) {
    const { error } = await supabase
      .from('drivers')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};
