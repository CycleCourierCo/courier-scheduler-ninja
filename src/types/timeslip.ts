export interface Timeslip {
  id: string;
  driver_id: string;
  date: string; // YYYY-MM-DD
  status: 'draft' | 'approved' | 'rejected';
  
  // Time tracking
  driving_hours: number;
  stop_hours: number;
  lunch_hours: number;
  total_hours: number; // Computed
  
  // Pay calculation
  hourly_rate: number;
  van_allowance: number;
  total_pay: number; // Computed
  
  // Job details
  total_stops: number;
  route_links: string[];
  job_locations: JobLocation[];
  
  // Metadata
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  approved_by: string | null;
  admin_notes: string | null;
  
  // Joined data
  driver?: Driver;
}

export interface JobLocation {
  lat: number;
  lng: number;
  type: 'pickup' | 'delivery';
  postcode?: string;
  order_id: string;
}

export interface Driver {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  hourly_rate: number;
  uses_own_van: boolean;
  van_allowance: number;
  is_active: boolean;
  available_hours: number | null;
  created_at: string;
  updated_at: string;
}
