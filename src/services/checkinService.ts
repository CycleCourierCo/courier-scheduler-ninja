import { supabase } from "@/integrations/supabase/client";
import { DriverCheckin, WeeklyCheckinBonus } from "@/types/checkin";
import { format } from 'date-fns';

export const checkinService = {
  // Get today's check-in for current driver
  async getTodayCheckin(driverId: string): Promise<DriverCheckin | null> {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('driver_checkins')
      .select('*')
      .eq('driver_id', driverId)
      .eq('checkin_date', today)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  // Get driver's check-in history
  async getCheckinHistory(driverId: string, limit = 30): Promise<DriverCheckin[]> {
    const { data, error } = await supabase
      .from('driver_checkins')
      .select('*')
      .eq('driver_id', driverId)
      .order('checkin_date', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  },

  // Upload photo to storage
  async uploadPhoto(
    driverId: string, 
    file: File, 
    type: 'fuel' | 'uniform'
  ): Promise<string> {
    const timestamp = Date.now();
    const today = format(new Date(), 'yyyy-MM-dd');
    const fileName = `${driverId}/${today}/${type}-${timestamp}.jpg`;
    
    const { error } = await supabase.storage
      .from('driver-checkins')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) throw error;
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('driver-checkins')
      .getPublicUrl(fileName);
    
    return publicUrl;
  },

  // Submit check-in
  async submitCheckin(
    driverId: string,
    fuelPhoto: File,
    uniformPhoto: File
  ): Promise<DriverCheckin> {
    // Upload photos
    const fuelPhotoUrl = await this.uploadPhoto(driverId, fuelPhoto, 'fuel');
    const uniformPhotoUrl = await this.uploadPhoto(driverId, uniformPhoto, 'uniform');
    
    const now = new Date();
    const { data, error } = await supabase
      .from('driver_checkins')
      .insert({
        driver_id: driverId,
        checkin_date: format(now, 'yyyy-MM-dd'),
        checkin_time: format(now, 'HH:mm:ss'),
        fuel_photo_url: fuelPhotoUrl,
        uniform_photo_url: uniformPhotoUrl
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get weekly bonuses for driver
  async getWeeklyBonuses(driverId: string): Promise<WeeklyCheckinBonus[]> {
    const { data, error } = await supabase
      .from('weekly_checkin_bonuses')
      .select('*')
      .eq('driver_id', driverId)
      .order('week_start_date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Admin: Get all check-ins for a date
  async getCheckinsByDate(date: string): Promise<DriverCheckin[]> {
    const { data, error } = await supabase
      .from('driver_checkins')
      .select('*')
      .eq('checkin_date', date)
      .order('checkin_time');
    
    if (error) throw error;
    return data || [];
  },

  // Admin: Get all drivers with check-in status
  async getAllDriversCheckinStatus(date: string) {
    const { data: drivers, error: driversError } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('role', 'driver')
      .eq('is_active', true);
    
    if (driversError) throw driversError;

    const { data: checkins, error: checkinsError } = await supabase
      .from('driver_checkins')
      .select('*')
      .eq('checkin_date', date);
    
    if (checkinsError) throw checkinsError;

    // Return combined data without joining profiles
    return drivers?.map(driver => ({
      ...driver,
      checkin: checkins?.find(c => c.driver_id === driver.id) || null
    })) || [];
  },

  // Admin: Calculate and award weekly bonuses
  async calculateWeeklyBonuses(weekStartDate: Date): Promise<void> {
    const { error } = await supabase.functions.invoke('calculate-weekly-bonuses', {
      body: { weekStartDate: format(weekStartDate, 'yyyy-MM-dd') }
    });
    
    if (error) throw error;
  },

  // Get current week stats for driver
  async getCurrentWeekStats(driverId: string) {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .rpc('calculate_weekly_checkin_compliance', {
        p_driver_id: driverId,
        p_week_start: format(monday, 'yyyy-MM-dd'),
        p_week_end: format(sunday, 'yyyy-MM-dd')
      });

    if (error) throw error;
    return data?.[0] || { total_checkins: 0, on_time_checkins: 0, compliance_percentage: 0 };
  }
};
