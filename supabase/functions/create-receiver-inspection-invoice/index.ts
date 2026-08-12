import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { Resend } from "https://esm.sh/resend@2.0.0";
import { prepareInvoiceDelivery } from "../_shared/quickbooksInvoiceDelivery.ts";

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

async function qbQuery(token: { access_token: string; company_id: string }, query: string) {
  const res = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${token.company_id}/query?query=${encodeURIComponent(query)}`,
    { headers: { 'Authorization': `Bearer ${token.access_token}`, 'Accept': 'application/json' } }
  );
  if (!res.ok) return null;
  return await res.json();
}

async function qbPost(token: { access_token: string; company_id: string }, entity: string, body: any) {
  const res = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${token.company_id}/${entity}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QuickBooks ${entity} failed: ${text.slice(0, 400)}`);
  }
  return await res.json();
}

function splitName(fullName?: string | null) {
  if (!fullName) return { given: '', family: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { given: parts[0], family: '' };
  return { given: parts.slice(0, -1).join(' '), family: parts[parts.length - 1] };
}

function buildReceiverInvoiceEmail(
  order: any,
  issue: any,
  publicUrl: string | null,
  hasPdf: boolean,
  totalAmount: number
): { html: string; text: string; subject: string } {
  const receiverName = (order.receiver as any)?.name || 'there';
  const trackingNumber = order.tracking_number || order.id;
  const bikeDesc = `${order.bike_brand || ''} ${order.bike_model || ''}`.trim() || 'your bike';
  const issueDesc = issue.issue_description || 'repair';
  const subject = `Invoice for your bike repair — CCC ${trackingNumber}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hello ${receiverName},</h2>
      <p>You have approved the following repair for ${bikeDesc}:</p>
      <div style="background-color: #f7f7f7; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Repair:</strong> ${issueDesc}</p>
        <p><strong>Amount:</strong> £${totalAmount.toFixed(2)} (including VAT)</p>
      </div>
      <p>This repair is to be paid by you directly to Cycle Courier Co., not by the person who booked the transport.</p>
      <div style="text-align: center; margin: 25px 0;">
        ${buildInvoiceCtaHtml(publicUrl, hasPdf)}
      </div>
      <p>Thank you,<br>CCC - Cycle Courier Co.</p>
    </div>
  `;

  const text = `Hello ${receiverName},

You have approved the following repair for ${bikeDesc}:

Repair: ${issueDesc}
Amount: £${totalAmount.toFixed(2)} (including VAT)

This repair is to be paid by you directly to Cycle Courier Co., not by the person who booked the transport.

${buildInvoiceCtaText(publicUrl, hasPdf)}

We will be in touch shortly to arrange payment.

Thank you,
CCC - Cycle Courier Co.`;


  return { html, text, subject };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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
    const { data: isMechanic } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'mechanic' });
    if (!isAdmin && !isMechanic) throw new Error('Admin or mechanic access required');

    const body = await req.json().catch(() => ({}));
    const { issueId } = body as { issueId?: string };
    if (!issueId) throw new Error('issueId is required');

    const { data: issue, error: issueError } = await supabase
      .from('inspection_issues')
      .select('*')
      .eq('id', issueId)
      .single();

    if (issueError || !issue) throw new Error('Issue not found');
    if (issue.status !== 'approved') throw new Error('Issue is not approved');
    if (issue.billing_party !== 'receiver') throw new Error('Issue is not billed to the receiver');
    if (!issue.estimated_cost || Number(issue.estimated_cost) <= 0) throw new Error('Issue has no cost to invoice');
    if (issue.invoice_number) {
      return new Response(JSON.stringify({
        success: true,
        invoiceNumber: issue.invoice_number,
        invoiceId: issue.invoice_id,
        invoiceUrl: issue.invoice_url,
        totalAmount: issue.estimated_cost,
        alreadyExists: true,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: inspection, error: inspectionError } = await supabase
      .from('bicycle_inspections')
      .select('id, order_id')
      .eq('id', issue.inspection_id)
      .single();
    if (inspectionError || !inspection) throw new Error('Inspection not found');

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, tracking_number, customer_order_number, bike_brand, bike_model, sender, receiver')
      .eq('id', inspection.order_id)
      .single();
    if (orderError || !order) throw new Error('Order not found');

    const receiver: any = order.receiver || {};
    if (!receiver.email) throw new Error('Receiver has no email address');

    const tokenData = await getValidQuickBooksToken(supabase, user.id);
    if (!tokenData) throw new Error('QuickBooks is not connected. Connect QuickBooks on the Invoices page first.');

    // VAT tax code
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

    // Bike Repair product
    const escapedProductName = escapeQuickBooksString('Bike Repair');
    const productQuery = `SELECT * FROM Item WHERE Name = '${escapedProductName}' AND Active=true`;
    const productResponse = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${tokenData.company_id}/query?query=${encodeURIComponent(productQuery)}`,
      { headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Accept': 'application/json' } }
    );
    let repairProductId: string | null = null;
    if (productResponse.ok) {
      const item = (await productResponse.json()).QueryResponse?.Item?.[0];
      if (item) repairProductId = item.Id;
    }
    if (!repairProductId) throw new Error('QuickBooks product "Bike Repair" not found.');

    // Find or create receiver customer
    let qbCustomerId: string | null = null;
    const escapedEmail = escapeQuickBooksString(receiver.email);
    const emailMatch = await qbQuery(
      tokenData,
      `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${escapedEmail}'`
    );
    qbCustomerId = emailMatch?.QueryResponse?.Customer?.[0]?.Id || null;

    if (!qbCustomerId) {
      const nameParts = splitName(receiver.name);
      const baseDisplayName = receiver.name || receiver.email;
      let displayName = baseDisplayName;
      // Try to create with the name; if it exists, suffix with email to avoid collisions.
      for (let attempt = 0; attempt < 2; attempt++) {
        const createBody: any = {
          DisplayName: displayName,
          PrimaryEmailAddr: { Address: receiver.email },
          ...(nameParts.given && { GivenName: nameParts.given }),
          ...(nameParts.family && { FamilyName: nameParts.family }),
        };
        try {
          const createResp = await qbPost(tokenData, 'customer', createBody);
          qbCustomerId = createResp.Customer?.Id;
          if (qbCustomerId) break;
        } catch (err: any) {
          if (attempt === 0 && err.message?.includes('Duplicate Name')) {
            displayName = `${baseDisplayName} (${receiver.email})`;
            continue;
          }
          throw err;
        }
      }
    }
    if (!qbCustomerId) throw new Error('Could not create or find a QuickBooks customer for the receiver.');

    // Net 7 terms
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

    const netPrice = Number((Number(issue.estimated_cost || 0) / 1.2).toFixed(2));
    const bikeDesc = `${order.tracking_number || order.id} - ${order.bike_brand || ''} ${order.bike_model || ''}`.trim();
    const lineItems = [{
      Amount: netPrice,
      DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: {
        ItemRef: { value: repairProductId },
        Qty: 1,
        UnitPrice: netPrice,
        ...(vatTaxCodeId && { TaxCodeRef: { value: vatTaxCodeId } })
      },
      Description: `${bikeDesc} - ${issue.issue_description}`
    }];

    const invoiceBody = {
      Line: lineItems,
      CustomerRef: { value: qbCustomerId },
      BillEmail: { Address: receiver.email },
      TxnDate: new Date().toISOString().split('T')[0],
      ...(salesTermId && { SalesTermRef: { value: salesTermId } })
    };

    const invoiceResponse = await qbPost(tokenData, 'invoice', invoiceBody);
    const qbInvoice = invoiceResponse.Invoice;
    const invoiceId = qbInvoice?.Id;
    const invoiceNumber = qbInvoice?.DocNumber;
    const invoiceUrl = `https://qbo.intuit.com/app/invoice?txnId=${invoiceId}`;
    const totalAmount = Number(issue.estimated_cost || 0);
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('inspection_issues')
      .update({
        invoice_number: invoiceNumber,
        invoice_id: invoiceId,
        invoice_url: invoiceUrl,
        invoiced_at: now,
        invoiced_by_id: user.id,
        invoiced_by_name: user.user_metadata?.name || user.email || 'Staff',
      })
      .eq('id', issueId);

    if (updateError) {
      console.error('Error updating issue with invoice data:', updateError);
    }

    // Send email to receiver
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        const email = buildReceiverInvoiceEmail(order, issue, invoiceUrl, totalAmount);
        await resend.emails.send({
          from: 'CCC - Cycle Courier Co. <Ccc@notification.cyclecourierco.com>',
          to: [receiver.email],
          reply_to: 'Info@cyclecourierco.com',
          subject: email.subject,
          html: email.html,
          text: email.text,
        });
        console.log('Receiver invoice email sent to:', receiver.email);
      } catch (emailErr) {
        console.error('Failed to send receiver invoice email:', emailErr);
        // Don't fail the whole request because the invoice was created.
      }
    } else {
      console.warn('RESEND_API_KEY not set; skipping receiver invoice email');
    }

    return new Response(JSON.stringify({
      success: true,
      invoiceNumber,
      invoiceId,
      invoiceUrl,
      totalAmount,
      customerId: qbCustomerId,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Error creating receiver inspection invoice:', error);
    const detail = error?.message || 'Failed to create receiver inspection invoice';
    return new Response(JSON.stringify({ error: detail }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);
