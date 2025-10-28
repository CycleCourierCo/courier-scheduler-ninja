import { supabase } from "@/integrations/supabase/client";
import { Driver } from "@/types/timeslip";
import { UserProfile } from "@/types/user";

export const driverService = {
  async getAllDrivers() {
    // Now fetch from profiles table where role is 'driver'
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'driver')
      .order('name', { ascending: true });
    
    if (error) throw error;
    
    // Map UserProfile to Driver format for backward compatibility
    return (data as UserProfile[]).map(profile => ({
      id: profile.id,
      name: profile.name || '',
      email: profile.email,
      phone: profile.phone,
      hourly_rate: profile.hourly_rate || 11,
      uses_own_van: profile.uses_own_van || false,
      van_allowance: profile.van_allowance || 0,
      is_active: profile.is_active !== false, // Default to true if null
      available_hours: profile.available_hours,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    })) as Driver[];
  },

  async updateDriver(id: string, updates: Partial<Driver>) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    // Map back to Driver format
    const profile = data as UserProfile;
    return {
      id: profile.id,
      name: profile.name || '',
      email: profile.email,
      phone: profile.phone,
      hourly_rate: profile.hourly_rate || 11,
      uses_own_van: profile.uses_own_van || false,
      van_allowance: profile.van_allowance || 0,
      is_active: profile.is_active !== false,
      available_hours: profile.available_hours,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    } as Driver;
  },

  async createDriver(driver: Omit<Driver, 'id' | 'created_at' | 'updated_at'>) {
    // Note: Creating drivers directly is now deprecated
    // Drivers should be created as users with the 'driver' role through the auth system
    throw new Error('Direct driver creation is deprecated. Create a user account with driver role instead.');
  },

  async deleteDriver(id: string) {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};
