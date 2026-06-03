import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BOX_MY_BIKE_PRODUCT_NAME = 'Box My Bike';
const BOX_MY_BIKE_NET_PRICE = 60; // £60 + VAT

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

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') throw new Error('Admin access required');

    const { orderId } = await req.json();
    if (!orderId) throw new Error('orderId is required');

    console.log('Creating Box My Bike invoice for order:', orderId);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, tracking_number, customer_order_number, bike_brand, bike_model, sender, receiver, user_id, created_at, is_box_my_bike, box_my_bike_invoice_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) throw new Error('Order not found');
    if (!order.is_box_my_bike) throw new Error('Order is not a Box My Bike order');
    if (order.box_my_bike_invoice_id) throw new Error('Box My Bike invoice already exists for this order');

    const { data: customerProfile, error: custError } = await supabase
      .from('profiles')
      .select('email, accounts_email')
      .eq('id', order.user_id)
      .single();

    if (custError || !customerProfile) throw new Error('Customer profile not found');
    const billingEmail = customerProfile.accounts_email || customerProfile.email;
    if (!billingEmail) throw new Error('Customer profile has no email or accounts_email');

    const tokenData = await getValidQuickBooksToken(supabase, user.id);
    if (!tokenData) throw new Error('QuickBooks not connected or refresh failed');

    // VAT tax code
    let vatTaxCodeId: string | null = null;
    const taxCodeResponse = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${tokenData.company_id}/query?query=${encodeURIComponent("SELECT * FROM TaxCode WHERE Active=true")}`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/json' } }
    );
    if (taxCodeResponse.ok) {
      const taxCodes = (await taxCodeResponse.json()).QueryResponse?.TaxCode || [];
      const vatCode = taxCodes.find((code: any) =>
        code.Name === '20.0% S' || code.Name === '20% S' || code.Name === 'Standard' ||
        code.Name?.includes('20%') || code.Name?.toLowerCase().includes('standard')
      );
      if (vatCode) vatTaxCodeId = vatCode.Id;
    }

    // Find "Box My Bike" product
    const escapedProductName = escapeQuickBooksString(BOX_MY_BIKE_PRODUCT_NAME);
    const productQuery = `SELECT * FROM Item WHERE Name = '${escapedProductName}' AND Active=true`;
    const productResponse = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${tokenData.company_id}/query?query=${encodeURIComponent(productQuery)}`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/json' } }
    );

    let boxProduct: { id: string; name: string; price: number } | null = null;
    if (productResponse.ok) {
      const item = (await productResponse.json()).QueryResponse?.Item?.[0];
      if (item) {
        boxProduct = { id: item.Id, name: item.Name, price: item.UnitPrice || BOX_MY_BIKE_NET_PRICE };
      }
    }
    if (!boxProduct) {
      throw new Error(`QuickBooks product "${BOX_MY_BIKE_PRODUCT_NAME}" not found. Please create it in QuickBooks first.`);
    }

    // Find customer
    const escapedEmail = escapeQuickBooksString(billingEmail);
    const customerQuery = `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${escapedEmail}'`;
    const customerResponse = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${tokenData.company_id}/query?query=${encodeURIComponent(customerQuery)}`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/json' } }
    );

    let qbCustomerId: string | null = null;
    if (customerResponse.ok) {
      const customers = (await customerResponse.json()).QueryResponse?.Customer || [];
      if (customers.length > 0) qbCustomerId = customers[0].Id;
    }
    if (!qbCustomerId) throw new Error(`Customer not found in QuickBooks for email: ${billingEmail}`);

    // Description
    const senderName = (order.sender as any)?.name || '';
    let description = `Box My Bike service – ${order.tracking_number || order.id}`;
    if (order.customer_order_number) description += ` (Order #${order.customer_order_number})`;
    if (order.bike_brand || order.bike_model) {
      description += ` - ${order.bike_brand || ''} ${order.bike_model || ''}`.trim();
    }
    if (senderName) description += ` - ${senderName}`;

    const serviceDate = order.created_at
      ? new Date(order.created_at).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const lineItems = [{
      Amount: boxProduct.price,
      DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: {
        ItemRef: { value: boxProduct.id, name: boxProduct.name },
        Qty: 1,
        UnitPrice: boxProduct.price,
        ServiceDate: serviceDate,
        ...(vatTaxCodeId && { TaxCodeRef: { value: vatTaxCodeId } }),
      },
      Description: description,
    }];

    // Net 7 terms
    let salesTermId: string | null = null;
    const termsResponse = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${tokenData.company_id}/query?query=${encodeURIComponent("SELECT * FROM Term WHERE Active=true")}`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/json' } }
    );
    if (termsResponse.ok) {
      const terms = (await termsResponse.json()).QueryResponse?.Term || [];
      const net7 = terms.find((t: any) => t.Name?.toLowerCase().includes('net 7') || t.DueDays === 7);
      if (net7) salesTermId = net7.Id;
    }

    const quickbooksInvoice = {
      Line: lineItems,
      CustomerRef: { value: qbCustomerId },
      BillEmail: { Address: billingEmail },
      TxnDate: new Date().toISOString().split('T')[0],
      ...(salesTermId && { SalesTermRef: { value: salesTermId } }),
    };

    const invoiceResponse = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${tokenData.company_id}/invoice`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(quickbooksInvoice),
      }
    );

    if (!invoiceResponse.ok) {
      const errorText = await invoiceResponse.text();
      console.error('QuickBooks API error:', errorText);
      throw new Error('Failed to create invoice in QuickBooks');
    }

    const qbResponse = await invoiceResponse.json();
    const qbInvoice = qbResponse.Invoice;
    const invoiceId = qbInvoice?.Id;
    const invoiceNumber = qbInvoice?.DocNumber;
    const invoiceUrl = `https://qbo.intuit.com/app/invoice?txnId=${invoiceId}`;

    // Persist invoice references on the order
    await supabase
      .from('orders')
      .update({
        box_my_bike_invoice_id: invoiceId,
        box_my_bike_invoice_number: invoiceNumber,
        box_my_bike_invoice_url: invoiceUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    console.log('Box My Bike invoice created:', invoiceNumber);

    return new Response(JSON.stringify({
      success: true,
      invoiceNumber,
      invoiceId,
      invoiceUrl,
      totalAmount: boxProduct.price,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error: any) {
    console.error('Error creating Box My Bike invoice:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create Box My Bike invoice' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);
