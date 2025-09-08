
export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: 'admin' | 'b2b_customer' | 'b2c_customer';
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
}
