import { UserProfile } from './user';

export interface DriverCheckin {
  id: string;
  driver_id: string;
  checkin_date: string;
  checkin_time: string;
  fuel_photo_url: string;
  uniform_photo_url: string;
  is_on_time: boolean;
  checkin_latitude: number | null;
  checkin_longitude: number | null;
  distance_from_depot_meters: number | null;
  created_at: string;
  updated_at: string;
  driver?: UserProfile;
}

export interface GeolocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface WeeklyCheckinBonus {
  id: string;
  driver_id: string;
  week_start_date: string;
  week_end_date: string;
  total_checkins: number;
  on_time_checkins: number;
  compliance_percentage: number;
  bonus_awarded: boolean;
  timeslip_id: string | null;
  created_at: string;
  driver?: UserProfile;
}

export interface CheckinFormData {
  fuelPhoto: File | null;
  uniformPhoto: File | null;
}
