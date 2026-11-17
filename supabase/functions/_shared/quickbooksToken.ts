// Shared QuickBooks access-token loader: returns the newest connection and
// refreshes it when it expires within five minutes.
export interface QuickBooksToken {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  company_id: string;
}

export async function getQuickBooksToken(supabase: any): Promise<QuickBooksToken | null> {
  const { data } = await supabase.from('quickbooks_tokens')
    .select('user_id, access_token, refresh_token, expires_at, company_id')
    .order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() - Date.now() > 5 * 60 * 1000) return data;
  const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
  const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
  if (!clientId || !clientSecret) return null;
  const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      Accept: 'application/json',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: data.refresh_token }).toString(),
  });
  if (!res.ok) return null;
  const r = await res.json();
  const expiresAt = new Date(Date.now() + r.expires_in * 1000).toISOString();
  await supabase.from('quickbooks_tokens').update({
    access_token: r.access_token, refresh_token: r.refresh_token || data.refresh_token,
    expires_at: expiresAt, updated_at: new Date().toISOString(),
  }).eq('user_id', data.user_id);
  return { ...data, access_token: r.access_token };
}
