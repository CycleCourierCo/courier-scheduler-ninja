import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { prepareInvoiceDelivery } from "../_shared/quickbooksInvoiceDelivery.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GUARANTEED_PRODUCT_NAME = 'Guaranteed Delivery Date';

function escapeQuickBooksString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function refreshQuickBooksToken(
  supabase: any,
  userId: string,
  refreshToken: string
): Promise<{ access_token: string; expires_at: string } | null> {
  try {
    const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
    if (!clientId || !clientSecret) return null;

    const credentials = btoa(`${clientId}:${clientSecret}`);
    const tokenParams = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
        Accept: 'application/json',
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) return null;

    const tokenData = await tokenResponse.json();
    const newExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

    await supabase
      .from('quickbooks_tokens')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || refreshToken,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    return { access_token: tokenData.access_token, expires_at: newExpiresAt };
  } catch (error) {
    console.error('Error refreshing QuickBooks token:', error);
    return null;
  }
}

async function getValidQuickBooksToken(
  supabase: any,
  userId: string
): Promise<{ access_token: string; company_id: string } | null> {
  const { data: tokenData, error } = await supabase
    .from('quickbooks_tokens')
    .select('access_token, refresh_token, expires_at, company_id')
    .eq('user_id', userId)
    .single();

  if (error || !tokenData) return null;

  const expiresAt = new Date(tokenData.expires_at);
  const bufferTime = 5 * 60 * 1000;

  if (expiresAt.getTime() - Date.now() < bufferTime) {
    const refreshResult = await refreshQuickBooksToken(supabase, userId, tokenData.refresh_token);
    if (!refreshResult) return null;
    return { access_token: refreshResult.access_token, company_id: tokenData.company_id };
  }

  return { access_token: tokenData.access_token, company_id: tokenData.company_id };
}

function qbFetch(url: string, accessToken: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Unauthorized');

    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) throw new Error('Admin access required');

    const body = await req.json();
    const orderId: string | undefined = body?.orderId;
    if (!orderId) throw new Error('orderId is required');

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, tracking_number, customer_order_number, bike_brand, bike_model, sender, receiver, created_at, guaranteed_delivery, guaranteed_delivery_payer, guaranteed_delivery_amount, guaranteed_delivery_note, guaranteed_delivery_invoice_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) throw new Error('Order not found');
    if (!order.guaranteed_delivery) throw new Error('Order is not marked as guaranteed date delivery');

    const payer = order.guaranteed_delivery_payer;
    if (payer !== 'sender' && payer !== 'receiver') {
      throw new Error('A standalone invoice is only created when the sender or receiver is paying');
    }

    const amount = Number(order.guaranteed_delivery_amount || 0);
    if (!(amount > 0)) throw new Error('Guaranteed delivery amount must be greater than zero');

    if (order.guaranteed_delivery_invoice_id) {
      return new Response(JSON.stringify({
        success: true,
        alreadyExists: true,
        invoiceId: order.guaranteed_delivery_invoice_id,
      }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const party = (payer === 'sender' ? order.sender : order.receiver) as any;
    const partyName: string = party?.name || '';
    const partyEmail: string = party?.email || '';
    if (!partyName) throw new Error(`The ${payer} has no name on this order`);

    const tokenData = await getValidQuickBooksToken(supabase, user.id);
    if (!tokenData) throw new Error('QuickBooks not connected or refresh failed');

    const companyId = tokenData.company_id;
    const accessToken = tokenData.access_token;

    // VAT tax code
    let vatTaxCodeId: string | null = null;
    const taxCodeResponse = await qbFetch(
      `https://quickbooks.api.intuit.com/v3/company/${companyId}/query?query=${encodeURIComponent("SELECT * FROM TaxCode WHERE Active=true")}`,
      accessToken
    );
    if (taxCodeResponse.ok) {
      const taxCodes = (await taxCodeResponse.json()).QueryResponse?.TaxCode || [];
      const vatCode = taxCodes.find((code: any) =>
        code.Name === '20.0% S' || code.Name === '20% S' || code.Name === 'Standard' ||
        code.Name?.includes('20%') || code.Name?.toLowerCase().includes('standard')
      );
      if (vatCode) vatTaxCodeId = vatCode.Id;
    }

    // Product
    const productQuery = `SELECT * FROM Item WHERE Name = '${escapeQuickBooksString(GUARANTEED_PRODUCT_NAME)}' AND Active=true`;
    const productResponse = await qbFetch(
      `https://quickbooks.api.intuit.com/v3/company/${companyId}/query?query=${encodeURIComponent(productQuery)}`,
      accessToken
    );
    const productItem = productResponse.ok
      ? (await productResponse.json()).QueryResponse?.Item?.[0]
      : null;
    if (!productItem) {
      throw new Error(`QuickBooks product "${GUARANTEED_PRODUCT_NAME}" not found. Please create it in QuickBooks first.`);
    }

    // Find or create the QuickBooks customer for the paying party
    let qbCustomerId: string | null = null;
    if (partyEmail) {
      const emailQuery = `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${escapeQuickBooksString(partyEmail)}'`;
      const res = await qbFetch(
        `https://quickbooks.api.intuit.com/v3/company/${companyId}/query?query=${encodeURIComponent(emailQuery)}`,
        accessToken
      );
      if (res.ok) {
        const customers = (await res.json()).QueryResponse?.Customer || [];
        if (customers.length > 0) qbCustomerId = customers[0].Id;
      }
    }

    if (!qbCustomerId) {
      const nameQuery = `SELECT * FROM Customer WHERE DisplayName = '${escapeQuickBooksString(partyName)}'`;
      const res = await qbFetch(
        `https://quickbooks.api.intuit.com/v3/company/${companyId}/query?query=${encodeURIComponent(nameQuery)}`,
        accessToken
      );
      if (res.ok) {
        const customers = (await res.json()).QueryResponse?.Customer || [];
        if (customers.length > 0) qbCustomerId = customers[0].Id;
      }
    }

    if (!qbCustomerId) {
      const addr = party?.address || {};
      const createPayload: Record<string, unknown> = {
        DisplayName: partyName,
        ...(partyEmail ? { PrimaryEmailAddr: { Address: partyEmail } } : {}),
        ...(party?.phone ? { PrimaryPhone: { FreeFormNumber: String(party.phone) } } : {}),
        BillAddr: {
          ...(addr.street ? { Line1: String(addr.street) } : {}),
          ...(addr.city ? { City: String(addr.city) } : {}),
          ...(addr.county || addr.state ? { CountrySubDivisionCode: String(addr.county || addr.state) } : {}),
          ...(addr.zipCode || addr.postcode ? { PostalCode: String(addr.zipCode || addr.postcode) } : {}),
          ...(addr.country ? { Country: String(addr.country) } : {}),
        },
      };

      const createRes = await qbFetch(
        `https://quickbooks.api.intuit.com/v3/company/${companyId}/customer`,
        accessToken,
        { method: 'POST', body: JSON.stringify(createPayload) }
      );
      if (!createRes.ok) {
        const errText = await createRes.text();
        console.error('QuickBooks customer creation failed:', errText);
        throw new Error(`Could not create a QuickBooks customer for the ${payer}`);
      }
      qbCustomerId = (await createRes.json()).Customer?.Id;
    }

    if (!qbCustomerId) throw new Error(`Could not resolve a QuickBooks customer for the ${payer}`);

    let description = `Guaranteed delivery date – ${order.tracking_number || order.id}`;
    if (order.customer_order_number) description += ` (Order #${order.customer_order_number})`;
    if (order.bike_brand || order.bike_model) {
      description += ` - ${order.bike_brand || ''} ${order.bike_model || ''}`.trim();
    }
    if (order.guaranteed_delivery_note) description += ` - ${order.guaranteed_delivery_note}`;

    const serviceDate = new Date().toISOString().split('T')[0];

    const lineItems = [{
      Amount: amount,
      DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: {
        ItemRef: { value: productItem.Id, name: productItem.Name },
        Qty: 1,
        UnitPrice: amount,
        ServiceDate: serviceDate,
        ...(vatTaxCodeId && { TaxCodeRef: { value: vatTaxCodeId } }),
      },
      Description: description,
    }];

    // Net 7 terms
    let salesTermId: string | null = null;
    const termsResponse = await qbFetch(
      `https://quickbooks.api.intuit.com/v3/company/${companyId}/query?query=${encodeURIComponent("SELECT * FROM Term WHERE Active=true")}`,
      accessToken
    );
    if (termsResponse.ok) {
      const terms = (await termsResponse.json()).QueryResponse?.Term || [];
      const net7 = terms.find((t: any) => t.Name?.toLowerCase().includes('net 7') || t.DueDays === 7);
      if (net7) salesTermId = net7.Id;
    }

    const quickbooksInvoice = {
      Line: lineItems,
      CustomerRef: { value: qbCustomerId },
      ...(partyEmail ? { BillEmail: { Address: partyEmail } } : {}),
      TxnDate: serviceDate,
      ...(salesTermId && { SalesTermRef: { value: salesTermId } }),
    };

    const invoiceResponse = await qbFetch(
      `https://quickbooks.api.intuit.com/v3/company/${companyId}/invoice`,
      accessToken,
      { method: 'POST', body: JSON.stringify(quickbooksInvoice) }
    );

    if (!invoiceResponse.ok) {
      const errorText = await invoiceResponse.text();
      console.error('QuickBooks API error:', errorText);
      throw new Error('Failed to create invoice in QuickBooks');
    }

    const qbInvoice = (await invoiceResponse.json()).Invoice;
    const invoiceId = qbInvoice?.Id;
    const invoiceNumber = qbInvoice?.DocNumber;
    const invoiceUrl = `https://qbo.intuit.com/app/invoice?txnId=${invoiceId}`;

    await supabase
      .from('orders')
      .update({
        guaranteed_delivery_invoice_id: invoiceId,
        guaranteed_delivery_invoice_number: invoiceNumber,
        guaranteed_delivery_invoice_url: invoiceUrl,
        guaranteed_delivery_invoiced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    console.log('Guaranteed delivery invoice created:', invoiceNumber);

    return new Response(JSON.stringify({
      success: true,
      invoiceNumber,
      invoiceId,
      invoiceUrl,
      totalAmount: amount,
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (error: any) {
    console.error('Error creating guaranteed delivery invoice:', error?.message || error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to create guaranteed delivery invoice' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);
