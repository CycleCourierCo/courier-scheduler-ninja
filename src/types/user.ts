
export type UserRole = 'admin' | 'b2b_customer' | 'b2c_customer' | 'driver' | 'loader' | 'mechanic' | 'route_planner' | 'sales';

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
}
