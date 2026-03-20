import { supabase } from "@/integrations/supabase/client";

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  lat: number | null;
  lon: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const fetchUserContacts = async (userId: string): Promise<Contact[]> => {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
    .order('name')
    .limit(5000);

  if (error) throw error;
  return data || [];
};

export const fetchAllContacts = async (): Promise<Contact[]> => {
  const PAGE_SIZE = 1000;
  let allData: Contact[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('name')
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allData = allData.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allData;
};

export interface UpsertContactData {
  name: string;
  email?: string | null;
  phone?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  lat?: number | null;
  lon?: number | null;
}

/**
 * Upsert a contact (create or update by user_id + email).
 * Returns the contact ID if successful, null otherwise.
 * Skips if email is null/empty (no reliable upsert key).
 */
export const upsertContact = async (
  userId: string,
  contactData: UpsertContactData
): Promise<string | null> => {
  // Skip if no email - can't reliably upsert without unique key
  if (!contactData.email?.trim()) {
    console.log('Skipping contact upsert - no email provided');
    return null;
  }

  const email = contactData.email.trim().toLowerCase();

  // Step 1: Upsert the contact (don't rely on return value due to CITEXT issues)
  const { error: upsertError } = await supabase
    .from('contacts')
    .upsert(
      {
        user_id: userId,
        name: contactData.name,
        email: email,
        phone: contactData.phone || null,
        street: contactData.street || null,
        city: contactData.city || null,
        state: contactData.state || null,
        postal_code: contactData.postal_code || null,
        country: contactData.country || null,
        lat: contactData.lat || null,
        lon: contactData.lon || null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,email',
        ignoreDuplicates: false,
      }
    );

  if (upsertError) {
    console.error('Failed to upsert contact:', upsertError);
    return null;
  }

  // Step 2: Fetch the contact ID explicitly (handles CITEXT case-insensitive matching)
  const { data, error } = await supabase
    .from('contacts')
    .select('id')
    .eq('user_id', userId)
    .ilike('email', email)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch contact ID after upsert:', error);
    return null;
  }

  console.log('Contact upserted successfully:', data?.id);
  return data?.id || null;
};
