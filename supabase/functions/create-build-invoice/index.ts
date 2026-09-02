import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { prepareInvoiceDelivery } from "../_shared/quickbooksInvoiceDelivery.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PARTS_PRODUCT_NAME = 'Bike Parts';
const LABOUR_PRODUCT_NAME = 'Labour';

function escapeQuickBooksString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function sanitiseQbString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    // deno-lint-ignore no-control-regex
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function refreshQuickBooksToken(supabase: any, userId: string, refreshToken: string) {
  try {
    const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
    if (!clientId || !clientSecret) return null;

    const credentials = btoa(`${clientId}:${clientSecret}`);
    const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
        Accept: 'application/json',
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
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
    return { access_token: tokenData.access_token };
  } catch (error) {
    console.error('Error refreshing QuickBooks token');
    return null;
  }
}

async function getValidQuickBooksToken(supabase: any, userId: string) {
  const { data: tokenData, error } = await supabase
    .from('quickbooks_tokens')
    .select('access_token, refresh_token, expires_at, company_id')
    .eq('user_id', userId)
    .single();
  if (error || !tokenData) return null;

  if (new Date(tokenData.expires_at).getTime() - Date.now() < 5 * 60 * 1000) {
    const refreshed = await refreshQuickBooksToken(supabase, userId, tokenData.refresh_token);
    if (!refreshed) return null;
    return { access_token: refreshed.access_token, company_id: tokenData.company_id };
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

async function findProduct(companyId: string, accessToken: string, name: string) {
  const query = `SELECT * FROM Item WHERE Name = '${escapeQuickBooksString(name)}' AND Active=true`;
  const res = await qbFetch(
    `https://quickbooks.api.intuit.com/v3/company/${companyId}/query?query=${encodeURIComponent(query)}`,
    accessToken
  );
  if (!res.ok) return null;
  return (await res.json()).QueryResponse?.Item?.[0] ?? null;
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
    const buildId: string | undefined = body?.buildId;
    if (!buildId || typeof buildId !== 'string') throw new Error('buildId is required');

    const { data: build, error: buildError } = await supabase
      .from('bike_builds')
      .select('*')
      .eq('id', buildId)
      .single();
    if (buildError || !build) throw new Error('Build not found');

    if (build.invoice_number) {
      return new Response(JSON.stringify({
        success: true,
        alreadyExists: true,
        invoiceNumber: build.invoice_number,
        invoiceUrl: build.invoice_url,
      }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const { data: components } = await supabase
      .from('bike_build_components')
      .select('category, quantity, unit_value')
      .eq('build_id', buildId);

    const partsTotal = ((components as any[]) || []).reduce(
      (sum, c) => sum + Number(c.unit_value || 0) * Number(c.quantity || 1),
      0
    );
    const labourTotal = Number(build.labour_cost || 0);
    const grandTotal = partsTotal + labourTotal;
    if (!(grandTotal > 0)) throw new Error('Nothing to invoice — add parts values or a labour charge first');

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, company_name, email, phone, address_line_1, city, county, postal_code')
      .eq('id', build.user_id)
      .single();

    const customerName = sanitiseQbString(profile?.company_name || profile?.name);
    const customerEmail = sanitiseQbString(profile?.email);
    if (!customerName) throw new Error('The customer has no name on their profile');

    const tokenData = await getValidQuickBooksToken(supabase, user.id);
    if (!tokenData) throw new Error('QuickBooks not connected or refresh failed');
    const { company_id: companyId, access_token: accessToken } = tokenData;

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

    const partsProduct = partsTotal > 0 ? await findProduct(companyId, accessToken, PARTS_PRODUCT_NAME) : null;
    const labourProduct = labourTotal > 0 ? await findProduct(companyId, accessToken, LABOUR_PRODUCT_NAME) : null;
    if (partsTotal > 0 && !partsProduct) {
      throw new Error(`QuickBooks product "${PARTS_PRODUCT_NAME}" not found. Please create it in QuickBooks first.`);
    }
    if (labourTotal > 0 && !labourProduct) {
      throw new Error(`QuickBooks product "${LABOUR_PRODUCT_NAME}" not found. Please create it in QuickBooks first.`);
    }

    // Resolve the QuickBooks customer
    let qbCustomerId: string | null = null;
    if (customerEmail) {
      const emailQuery = `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${escapeQuickBooksString(customerEmail)}'`;
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
      const nameQuery = `SELECT * FROM Customer WHERE DisplayName = '${escapeQuickBooksString(customerName)}'`;
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
      const createRes = await qbFetch(
        `https://quickbooks.api.intuit.com/v3/company/${companyId}/customer`,
        accessToken,
        {
          method: 'POST',
          body: JSON.stringify({
            DisplayName: customerName,
            ...(customerEmail ? { PrimaryEmailAddr: { Address: customerEmail } } : {}),
            ...(profile?.phone ? { PrimaryPhone: { FreeFormNumber: sanitiseQbString(profile.phone) } } : {}),
            BillAddr: {
              ...(profile?.address_line_1 ? { Line1: sanitiseQbString(profile.address_line_1) } : {}),
              ...(profile?.city ? { City: sanitiseQbString(profile.city) } : {}),
              ...(profile?.county ? { CountrySubDivisionCode: sanitiseQbString(profile.county) } : {}),
              ...(profile?.postal_code ? { PostalCode: sanitiseQbString(profile.postal_code) } : {}),
            },
          }),
        }
      );
      if (!createRes.ok) {
        console.error('QuickBooks customer creation failed');
        throw new Error('Could not create a QuickBooks customer for this build');
      }
      qbCustomerId = (await createRes.json()).Customer?.Id;
    }
    if (!qbCustomerId) throw new Error('Could not resolve a QuickBooks customer for this build');

    const serviceDate = new Date().toISOString().split('T')[0];
    const buildLabel = sanitiseQbString(build.name) || 'Bike build';
    const bikeLabel = sanitiseQbString(`${build.bike_brand || ''} ${build.bike_model || ''}`);
    const lineItems: Record<string, unknown>[] = [];

    if (partsTotal > 0 && partsProduct) {
      lineItems.push({
        Amount: partsTotal,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          ItemRef: { value: partsProduct.Id, name: partsProduct.Name },
          Qty: 1,
          UnitPrice: partsTotal,
          ServiceDate: serviceDate,
          ...(vatTaxCodeId && { TaxCodeRef: { value: vatTaxCodeId } }),
        },
        Description: `Parts – ${buildLabel}${bikeLabel ? ` (${bikeLabel})` : ''}`,
      });
    }
    if (labourTotal > 0 && labourProduct) {
      lineItems.push({
        Amount: labourTotal,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          ItemRef: { value: labourProduct.Id, name: labourProduct.Name },
          Qty: 1,
          UnitPrice: labourTotal,
          ServiceDate: serviceDate,
          ...(vatTaxCodeId && { TaxCodeRef: { value: vatTaxCodeId } }),
        },
        Description: `Build labour – ${buildLabel}`,
      });
    }

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

    const invoiceResponse = await qbFetch(
      `https://quickbooks.api.intuit.com/v3/company/${companyId}/invoice`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          Line: lineItems,
          CustomerRef: { value: qbCustomerId },
          ...(customerEmail ? { BillEmail: { Address: customerEmail } } : {}),
          TxnDate: serviceDate,
          ...(salesTermId && { SalesTermRef: { value: salesTermId } }),
        }),
      }
    );

    if (!invoiceResponse.ok) {
      console.error('QuickBooks API error creating build invoice');
      throw new Error('Failed to create invoice in QuickBooks');
    }

    const qbInvoice = (await invoiceResponse.json()).Invoice;
    const invoiceId = qbInvoice?.Id;
    const invoiceNumber = qbInvoice?.DocNumber;
    const invoiceUrl = `https://qbo.intuit.com/app/invoice?txnId=${invoiceId}`;

    const delivery = await prepareInvoiceDelivery(
      accessToken,
      companyId,
      invoiceId,
      customerEmail,
      { fetchPdf: false }
    );

    await supabase
      .from('bike_builds')
      .update({
        stage: 'invoiced',
        parts_total: partsTotal,
        invoice_number: invoiceNumber,
        invoice_url: delivery.publicUrl || invoiceUrl,
        invoiced_at: new Date().toISOString(),
      })
      .eq('id', buildId);

    return new Response(JSON.stringify({
      success: true,
      invoiceId,
      invoiceNumber,
      invoiceUrl,
      invoicePublicUrl: delivery.publicUrl,
      totalAmount: grandTotal,
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (error: any) {
    console.error('Error creating build invoice:', error?.message || 'unknown');
    return new Response(
      JSON.stringify({ error: error?.message || 'Failed to create build invoice' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);
