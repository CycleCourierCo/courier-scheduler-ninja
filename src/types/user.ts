
export type UserRole = 'admin' | 'b2b_customer' | 'b2c_customer' | 'driver' | 'loader' | 'mechanic' | 'route_planner' | 'sales';

export interface DayHours {
  open: boolean;
  start: string;
  end: string;
  is24h: boolean;
}

export interface OpeningHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

export const DEFAULT_OPENING_HOURS: OpeningHours = {
  monday:    { open: true, start: "09:00", end: "17:00", is24h: false },
  tuesday:   { open: true, start: "09:00", end: "17:00", is24h: false },
  wednesday: { open: true, start: "09:00", end: "17:00", is24h: false },
  thursday:  { open: true, start: "09:00", end: "17:00", is24h: false },
  friday:    { open: true, start: "09:00", end: "17:00", is24h: false },
  saturday:  { open: false, start: "", end: "", is24h: false },
  sunday:    { open: false, start: "", end: "", is24h: false },
};

export const DAY_NAMES: (keyof OpeningHours)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  is_business: boolean | null;
  company_name: string | null;
  website: string | null;
  account_status: 'pending' | 'approved' | 'rejected' | 'suspended' | null;
  created_at: string;
  updated_at: string;
  table_preferences: any | null;
  // Address fields
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  postal_code: string | null;
  accounts_email: string | null;
  // Driver fields
  hourly_rate: number | null;
  uses_own_van: boolean | null;
  van_allowance: number | null;
  is_active: boolean | null;
  available_hours: number | null;
  shipday_driver_id: string | null;
  shipday_driver_name: string | null;
  // Invoice pricing
  special_rate_code: string | null;
  special_rate_price: number | null;
  // Opening hours
  opening_hours: any | null;
}
