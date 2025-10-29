import { supabase } from "@/integrations/supabase/client";
import { Timeslip, JobLocation, CustomAddon } from "@/types/timeslip";

export const timeslipService = {
  // Get all timeslips (admin only)
  async getAllTimeslips(filters?: {
    status?: 'draft' | 'approved' | 'rejected';
    driverId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    let query = supabase
      .from('timeslips')
      .select('*, driver:profiles!timeslips_driver_id_fkey(*)')
      .order('date', { ascending: false });
    
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    
    if (filters?.driverId) {
      query = query.eq('driver_id', filters.driverId);
    }
    
    if (filters?.dateFrom) {
      query = query.gte('date', filters.dateFrom);
    }
    
    if (filters?.dateTo) {
      query = query.lte('date', filters.dateTo);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(item => ({
      ...item,
      job_locations: (item.job_locations as any as JobLocation[]) || [],
      custom_addons: (item.custom_addons as any as CustomAddon[]) || []
    })) as Timeslip[];
  },

  // Get driver's approved timeslips
  async getDriverTimeslips(driverId: string) {
    const { data, error } = await supabase
      .from('timeslips')
      .select('*, driver:profiles!timeslips_driver_id_fkey(*)')
      .eq('driver_id', driverId)
      .eq('status', 'approved')
      .order('date', { ascending: false });
    
    if (error) throw error;
    return (data || []).map(item => ({
      ...item,
      job_locations: (item.job_locations as any as JobLocation[]) || [],
      custom_addons: (item.custom_addons as any as CustomAddon[]) || []
    })) as Timeslip[];
  },

  // Generate timeslips for a date
  async generateTimeslips(date: string) {
    const { data, error } = await supabase.functions.invoke('generate-timeslips', {
      body: { date }
    });
    
    if (error) throw error;
    return data;
  },

  // Update timeslip
  async updateTimeslip(id: string, updates: Partial<Timeslip>) {
    const updateData: any = { ...updates };
    if (updateData.job_locations) {
      delete updateData.job_locations;
    }
    
    const { data, error } = await supabase
      .from('timeslips')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return {
      ...data,
      job_locations: (data.job_locations as any as JobLocation[]) || [],
      custom_addons: (data.custom_addons as any as CustomAddon[]) || []
    } as Timeslip;
  },

  // Approve timeslip
  async approveTimeslip(id: string, adminNotes?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('timeslips')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user?.id,
        admin_notes: adminNotes || null
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return {
      ...data,
      job_locations: (data.job_locations as any as JobLocation[]) || [],
      custom_addons: (data.custom_addons as any as CustomAddon[]) || []
    } as Timeslip;
  },

  // Reject timeslip
  async rejectTimeslip(id: string, adminNotes: string) {
    const { data, error } = await supabase
      .from('timeslips')
      .update({
        status: 'rejected',
        admin_notes: adminNotes
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return {
      ...data,
      job_locations: (data.job_locations as any as JobLocation[]) || [],
      custom_addons: (data.custom_addons as any as CustomAddon[]) || []
    } as Timeslip;
  },

  // Delete timeslip
  async deleteTimeslip(id: string) {
    const { error } = await supabase
      .from('timeslips')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};
