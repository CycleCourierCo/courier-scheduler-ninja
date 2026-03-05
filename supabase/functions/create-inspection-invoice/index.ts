import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      'grant_type': 'refresh_token',
      'refresh_token': refreshToken
    });

    const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
        'Accept': 'application/json'
      },
      body: tokenParams.toString()
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
        updated_at: new Date().toISOString()
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

    // Auth check
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

    const { inspectionId } = await req.json();
    if (!inspectionId) throw new Error('inspectionId is required');

    console.log('Creating inspection invoice for inspection:', inspectionId);

    // Fetch inspection with order details
    const { data: inspection, error: inspError } = await supabase
      .from('bicycle_inspections')
      .select('*, inspection_issues(*)')
      .eq('id', inspectionId)
      .single();

    if (inspError || !inspection) throw new Error('Inspection not found');
    if (inspection.invoice_number) throw new Error('Invoice already created for this inspection');

    // Get approved/repaired issues with costs
    const billableIssues = (inspection.inspection_issues || []).filter(
      (issue: any) => (issue.status === 'approved' || issue.status === 'repaired') && issue.estimated_cost
    );

    if (billableIssues.length === 0) {
      throw new Error('No approved issues with costs to invoice');
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, tracking_number, bike_brand, bike_model, user_id, sender, receiver')
      .eq('id', inspection.order_id)
      .single();

    if (orderError || !order) throw new Error('Order not found');

    // Get customer profile
    const { data: customerProfile, error: custError } = await supabase
      .from('profiles')
      .select('email, accounts_email, name, company_name')
      .eq('id', order.user_id)
      .single();

    if (custError || !customerProfile) throw new Error('Customer profile not found');
    const billingEmail = customerProfile.accounts_email || customerProfile.email;
    if (!billingEmail) throw new Error('Customer profile has no email or accounts_email');

    // Get QuickBooks token
    const tokenData = await getValidQuickBooksToken(supabase, user.id);
    if (!tokenData) throw new Error('QuickBooks not connected or refresh failed');

    // Find VAT tax code
    let vatTaxCodeId: string | null = null;
    const taxCodeResponse = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${tokenData.company_id}/query?query=${encodeURIComponent("SELECT * FROM TaxCode WHERE Active=true")}`,
      { headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Accept': 'application/json' } }
    );

    if (taxCodeResponse.ok) {
      const taxCodes = (await taxCodeResponse.json()).QueryResponse?.TaxCode || [];
      const vatCode = taxCodes.find((code: any) =>
        code.Name === '20.0% S' || code.Name === '20% S' || code.Name === 'Standard' ||
        code.Name?.includes('20%') || code.Name?.toLowerCase().includes('standard')
      );
      if (vatCode) vatTaxCodeId = vatCode.Id;
    }

    // Find "Bike Repair" product in QuickBooks
    const escapedProductName = escapeQuickBooksString('Bike Repair');
    const productQuery = `SELECT * FROM Item WHERE Name = '${escapedProductName}' AND Active=true`;
    const productResponse = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${tokenData.company_id}/query?query=${encodeURIComponent(productQuery)}`,
      { headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Accept': 'application/json' } }
    );

    let repairProductId: string | null = null;
    if (productResponse.ok) {
      const item = (await productResponse.json()).QueryResponse?.Item?.[0];
      if (item) {
        repairProductId = item.Id;
        console.log('Found Bike Repair product:', repairProductId);
      }
    }

    if (!repairProductId) {
      throw new Error('QuickBooks product "Bike Repair" not found. Please create it in QuickBooks first.');
    }

    // Find customer in QuickBooks
    const escapedEmail = escapeQuickBooksString(billingEmail);
    const customerQuery = `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${escapedEmail}'`;
    const customerResponse = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${tokenData.company_id}/query?query=${encodeURIComponent(customerQuery)}`,
      { headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Accept': 'application/json' } }
    );

    let qbCustomerId: string | null = null;
    if (customerResponse.ok) {
      const customers = (await customerResponse.json()).QueryResponse?.Customer || [];
      if (customers.length > 0) {
        qbCustomerId = customers[0].Id;
      }
    }

    if (!qbCustomerId) {
      throw new Error(`Customer not found in QuickBooks for email: ${billingEmail}`);
    }

    // Build line items from approved issues
    const bikeDesc = `${order.tracking_number || order.id} - ${order.bike_brand || ''} ${order.bike_model || ''}`.trim();
    const lineItems = billableIssues.map((issue: any) => {
      // estimated_cost is VAT-inclusive, so divide by 1.2 to get net price
      const netPrice = Number((Number(issue.estimated_cost) / 1.2).toFixed(2));
      return {
        Amount: netPrice,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: repairProductId },
          Qty: 1,
          UnitPrice: netPrice,
          ...(vatTaxCodeId && { TaxCodeRef: { value: vatTaxCodeId } })
        },
        Description: `${bikeDesc} - ${issue.issue_description}`
      };
    });

    // Get sales terms (Net 7)
    let salesTermId: string | null = null;
    const termsResponse = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${tokenData.company_id}/query?query=${encodeURIComponent("SELECT * FROM Term WHERE Active=true")}`,
      { headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Accept': 'application/json' } }
    );
    if (termsResponse.ok) {
      const terms = (await termsResponse.json()).QueryResponse?.Term || [];
      const net7 = terms.find((t: any) => t.Name?.toLowerCase().includes('net 7') || t.DueDays === 7);
      if (net7) salesTermId = net7.Id;
    }

    // Create invoice
    const quickbooksInvoice = {
      Line: lineItems,
      CustomerRef: { value: qbCustomerId },
      BillEmail: { Address: billingEmail },
      TxnDate: new Date().toISOString().split('T')[0],
      ...(salesTermId && { SalesTermRef: { value: salesTermId } })
    };

    const invoiceResponse = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${tokenData.company_id}/invoice`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(quickbooksInvoice)
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

    console.log('QuickBooks invoice created:', invoiceNumber);

    // Update bicycle_inspections with invoice data
    const { error: updateError } = await supabase
      .from('bicycle_inspections')
      .update({
        invoice_number: invoiceNumber,
        invoice_id: invoiceId,
        invoice_url: invoiceUrl,
      })
      .eq('id', inspectionId);

    if (updateError) {
      console.error('Error updating inspection with invoice data:', updateError);
    }

    const totalAmount = lineItems.reduce((sum: number, item: any) => sum + item.Amount, 0);

    return new Response(JSON.stringify({
      success: true,
      invoiceNumber,
      invoiceId,
      invoiceUrl,
      totalAmount,
      lineItemCount: lineItems.length,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error creating inspection invoice:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create inspection invoice' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);
