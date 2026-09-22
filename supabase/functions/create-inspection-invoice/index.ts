import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { prepareInvoiceDelivery } from "../_shared/quickbooksInvoiceDelivery.ts";

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

    const body = await req.json().catch(() => ({}));
    const {
      inspectionId,
      mode,
      search,
      billingEmailOverride,
      quickbooksCustomerId,
      customerDetails,
      billFrom,
    } = (body || {}) as {
      inspectionId?: string;
      mode?: string;
      search?: string;
      billingEmailOverride?: string;
      quickbooksCustomerId?: string;
      billFrom?: 'sender' | 'receiver' | 'account';
      customerDetails?: {
        name?: string;
        email?: string;
        phone?: string;
        company?: string;
        addressLine1?: string;
        addressLine2?: string;
        city?: string;
        postcode?: string;
      };
    };

    const qbQuery = async (token: { access_token: string; company_id: string }, query: string) => {
      const res = await fetch(
        `https://quickbooks.api.intuit.com/v3/company/${token.company_id}/query?query=${encodeURIComponent(query)}`,
        { headers: { 'Authorization': `Bearer ${token.access_token}`, 'Accept': 'application/json' } }
      );
      if (!res.ok) return null;
      return await res.json();
    };

    const mapCustomer = (c: any) => ({
      id: c.Id,
      name: c.DisplayName || c.CompanyName || c.FullyQualifiedName || '',
      email: c.PrimaryEmailAddr?.Address || null,
    });

    // --- Customer search mode (used by the "Choose billing customer" dialog) ---
    if (mode === 'search-customers') {
      const searchToken = await getValidQuickBooksToken(supabase, user.id);
      if (!searchToken) {
        return new Response(
          JSON.stringify({ error: 'QuickBooks is not connected. Connect QuickBooks on the Invoices page first.' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const term = escapeQuickBooksString(String(search || '').trim());
      const query = term
        ? `SELECT * FROM Customer WHERE Active = true AND DisplayName LIKE '%${term}%' MAXRESULTS 25`
        : `SELECT * FROM Customer WHERE Active = true MAXRESULTS 25`;

      let customers = (await qbQuery(searchToken, query))?.QueryResponse?.Customer || [];

      // Also try an email match so admins can paste an address.
      if (term && term.includes('@')) {
        const byEmail =
          (await qbQuery(searchToken, `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${term}'`))
            ?.QueryResponse?.Customer || [];
        const seen = new Set(customers.map((c: any) => c.Id));
        customers = [...customers, ...byEmail.filter((c: any) => !seen.has(c.Id))];
      }

      return new Response(JSON.stringify({ customers: customers.map(mapCustomer) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

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

    // Get approved/repaired issues with costs, excluding work billed to the
    // receiver (they are invoiced directly, never the booking customer)
    const billableIssues = (inspection.inspection_issues || []).filter(
      (issue: any) =>
        (issue.status === 'approved' || issue.status === 'repaired') &&
        issue.estimated_cost &&
        issue.billing_party !== 'receiver'
    );

    if (billableIssues.length === 0) {
      throw new Error('No approved customer-billed issues with costs to invoice');
    }


    // Workshop-only inspections have no transport job; the customer details
    // live on the inspection itself (and can be corrected by staff at invoice
    // time via `customerDetails`).
    const isWorkshopOnly = !inspection.order_id;

    let order: any = null;
    let customerProfile: any = null;

    if (!isWorkshopOnly) {
      const { data: orderRow, error: orderError } = await supabase
        .from('orders')
        .select('id, tracking_number, bike_brand, bike_model, user_id, sender, receiver')
        .eq('id', inspection.order_id)
        .single();
      if (orderError || !orderRow) throw new Error('Order not found');
      order = orderRow;

      const { data: profileRow, error: custError } = await supabase
        .from('profiles')
        .select('email, accounts_email, name, company_name')
        .eq('id', order.user_id)
        .single();
      if (custError || !profileRow) throw new Error('Customer profile not found');
      customerProfile = profileRow;
    } else {
      order = {
        id: inspection.id,
        tracking_number: inspection.reference || null,
        bike_brand: inspection.bike_brand,
        bike_model: inspection.bike_model,
        user_id: null,
        sender: null,
        receiver: null,
      };
      customerProfile = {
        email: customerDetails?.email || inspection.customer_email,
        accounts_email: null,
        name: customerDetails?.name || inspection.customer_name,
        company_name: customerDetails?.company || inspection.customer_company,
      };
    }

    const isInternalEmail = (email?: string | null) =>
      !!email && email.toLowerCase().includes('@cyclecourierco.com');

    // Sender/receiver contact snapshot on the job — used when staff choose to
    // bill one of the two parties directly.
    const str = (v: any) => (v === null || v === undefined ? '' : String(v).trim());
    const partyDetails = (side: 'sender' | 'receiver') => {
      const raw = (order as any)?.[side];
      if (!raw || typeof raw !== 'object') return null;
      const addr = (raw.address || {}) as Record<string, any>;
      const details = {
        side,
        name: str(raw.name),
        company: str(raw.company || raw.company_name),
        email: str(raw.email),
        phone: str(raw.phone),
        addressLine1: str(addr.street),
        addressLine2: '',
        city: str(addr.city),
        postcode: str(addr.zipCode || addr.postcode),
      };
      if (!details.name && !details.email) return null;
      return details;
    };

    const senderParty = partyDetails('sender');
    const receiverParty = partyDetails('receiver');
    // The account that booked the job — billable in its own right.
    const accountParty = (() => {
      const email = str(customerProfile?.accounts_email) || str(customerProfile?.email);
      const name = str(customerProfile?.name);
      const company = str(customerProfile?.company_name);
      if (!email && !name && !company) return null;
      return {
        side: 'account' as const,
        name,
        company,
        email,
        phone: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        postcode: '',
      };
    })();
    const chosenParty =
      billFrom === 'sender'
        ? senderParty
        : billFrom === 'receiver'
        ? receiverParty
        : billFrom === 'account'
        ? accountParty
        : null;

    // Candidate billing identities, most authoritative first. Internal
    // addresses are skipped so a staff-booked order never invoices ourselves.
    const emailCandidates: string[] = [];
    const pushEmail = (email?: string | null) => {
      if (!email) return;
      const clean = String(email).trim();
      if (!clean || isInternalEmail(clean)) return;
      if (!emailCandidates.some(e => e.toLowerCase() === clean.toLowerCase())) emailCandidates.push(clean);
    };

    if (billingEmailOverride) pushEmail(billingEmailOverride);
    if (chosenParty) pushEmail(chosenParty.email);
    if (!chosenParty) {
      pushEmail(customerProfile.accounts_email);
      pushEmail(customerProfile.email);
      pushEmail((order.sender as any)?.email);
      pushEmail((order.receiver as any)?.email);
    }

    const nameCandidates = (
      chosenParty
        ? [chosenParty.company, chosenParty.name]
        : [
            customerProfile.company_name,
            customerProfile.name,
            (order.sender as any)?.name,
            (order.receiver as any)?.name,
          ]
    )
      .map(n => (n ? String(n).trim() : ''))
      .filter(Boolean);

    // Get QuickBooks token
    const tokenData = await getValidQuickBooksToken(supabase, user.id);
    if (!tokenData) throw new Error('QuickBooks is not connected. Connect QuickBooks on the Invoices page first.');


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
    let qbCustomerId: string | null = null;
    let billingEmail: string | null = billingEmailOverride?.trim() || null;

    // 1) Explicit customer chosen by the admin in the dialog.
    if (quickbooksCustomerId) {
      const chosen = (await qbQuery(
        tokenData,
        `SELECT * FROM Customer WHERE Id = '${escapeQuickBooksString(String(quickbooksCustomerId))}'`,
      ))?.QueryResponse?.Customer?.[0];
      if (!chosen) {
        return new Response(
          JSON.stringify({ error: 'The selected QuickBooks customer could not be found.' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      qbCustomerId = chosen.Id;
      billingEmail = billingEmail || chosen.PrimaryEmailAddr?.Address || null;
    }

    // 2) Auto-match on the payer emails, then on names.
    if (!qbCustomerId) {
      for (const candidate of emailCandidates) {
        const match = (await qbQuery(
          tokenData,
          `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${escapeQuickBooksString(candidate)}'`,
        ))?.QueryResponse?.Customer?.[0];
        if (match) {
          qbCustomerId = match.Id;
          billingEmail = candidate;
          break;
        }
      }
    }

    if (!qbCustomerId) {
      for (const name of nameCandidates) {
        const match = (await qbQuery(
          tokenData,
          `SELECT * FROM Customer WHERE DisplayName = '${escapeQuickBooksString(name)}'`,
        ))?.QueryResponse?.Customer?.[0];
        if (match) {
          qbCustomerId = match.Id;
          billingEmail = billingEmail || match.PrimaryEmailAddr?.Address || null;
          break;
        }
      }
    }

    // Create a QuickBooks customer from confirmed contact details. Shared by
    // walk-in inspections and the "bill the sender/receiver" route.
    const createQuickBooksCustomer = async (details: {
      name?: string;
      company?: string;
      email?: string;
      phone?: string;
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      postcode?: string;
    }): Promise<{ id: string; email: string } | null> => {
      const baseName = (details.company || details.name || '').toString().trim();
      const email = (details.email || '').toString().trim();
      if (!baseName || !email) return null;

      const attempt = async (displayName: string) => {
        const nameParts = (details.name || displayName).trim().split(/\s+/);
        const payload: Record<string, unknown> = {
          DisplayName: displayName,
          GivenName: nameParts[0],
          ...(nameParts.length > 1 ? { FamilyName: nameParts.slice(1).join(' ') } : {}),
          PrimaryEmailAddr: { Address: email },
          ...(details.phone ? { PrimaryPhone: { FreeFormNumber: details.phone } } : {}),
          ...(details.addressLine1
            ? {
                BillAddr: {
                  Line1: details.addressLine1,
                  ...(details.addressLine2 ? { Line2: details.addressLine2 } : {}),
                  ...(details.city ? { City: details.city } : {}),
                  ...(details.postcode ? { PostalCode: details.postcode } : {}),
                  Country: 'United Kingdom',
                },
              }
            : {}),
        };
        const res = await fetch(
          `https://quickbooks.api.intuit.com/v3/company/${tokenData.company_id}/customer`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          }
        );
        if (res.ok) {
          const created = (await res.json())?.Customer;
          return created?.Id ? { id: created.Id as string, email } : null;
        }
        console.error('Failed to create QuickBooks customer:', (await res.text()).slice(0, 200));
        return null;
      };

      // Name collisions are resolved by suffixing the email address.
      return (await attempt(baseName)) || (await attempt(`${baseName} (${email})`));
    };

    // 2b) Workshop-only walk-in: create the QuickBooks customer from the
    // details staff confirmed, so a first-time customer can be invoiced.
    if (!qbCustomerId && isWorkshopOnly) {
      const created = await createQuickBooksCustomer({
        name: customerDetails?.name || customerProfile.name,
        company: customerDetails?.company || customerProfile.company_name,
        email: customerDetails?.email || customerProfile.email,
        phone: customerDetails?.phone,
        addressLine1: customerDetails?.addressLine1,
        addressLine2: customerDetails?.addressLine2,
        city: customerDetails?.city,
        postcode: customerDetails?.postcode,
      });
      if (created) {
        qbCustomerId = created.id;
        billingEmail = billingEmail || created.email;
        console.log('Created QuickBooks customer for workshop inspection');
      }
    }

    // 2c) Staff chose to bill the sender or receiver and they aren't in
    // QuickBooks yet — create them from the job's contact snapshot.
    if (!qbCustomerId && chosenParty) {
      const created = await createQuickBooksCustomer({
        ...chosenParty,
        email: billingEmailOverride?.trim() || chosenParty.email,
      });
      if (created) {
        qbCustomerId = created.id;
        billingEmail = billingEmail || created.email;
        console.log(`Created QuickBooks customer for ${chosenParty.side}`);
      }
    }

    // 3) Nothing matched — hand the decision back to the admin.
    if (!qbCustomerId) {
      const suggestions =
        (await qbQuery(
          tokenData,
          nameCandidates[0]
            ? `SELECT * FROM Customer WHERE Active = true AND DisplayName LIKE '%${escapeQuickBooksString(nameCandidates[0])}%' MAXRESULTS 15`
            : `SELECT * FROM Customer WHERE Active = true MAXRESULTS 15`,
        ))?.QueryResponse?.Customer || [];

      return new Response(
        JSON.stringify({
          error: 'customer_not_matched',
          message: chosenParty
            ? `Could not bill the ${chosenParty.side}. Check their name and email, or choose an existing QuickBooks customer.`
            : 'No QuickBooks customer matched this order. Choose the billing customer to continue.',
          triedEmails: emailCandidates,
          triedNames: nameCandidates,
          suggestions: suggestions.map(mapCustomer),
          parties: {
            ...(senderParty ? { sender: senderParty } : {}),
            ...(receiverParty ? { receiver: receiverParty } : {}),
          },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!billingEmail) {
      const current = (await qbQuery(
        tokenData,
        `SELECT * FROM Customer WHERE Id = '${escapeQuickBooksString(qbCustomerId)}'`,
      ))?.QueryResponse?.Customer?.[0];
      billingEmail = current?.PrimaryEmailAddr?.Address || null;
    }


    // Build line items from approved issues
    const bikeRef = isWorkshopOnly
      ? (inspection.reference || 'Workshop repair')
      : (order.tracking_number || order.id);
    const bikeDesc = `${bikeRef} - ${order.bike_brand || ''} ${order.bike_model || ''}`.trim();
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
      ...(billingEmail && { BillEmail: { Address: billingEmail } }),
      TxnDate: inspection.inspected_at
        ? new Date(inspection.inspected_at).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
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
      let detail = '';
      try {
        const parsed = JSON.parse(errorText);
        const fault = parsed?.Fault?.Error?.[0];
        detail = [fault?.Message, fault?.Detail].filter(Boolean).join(' — ');
      } catch {
        detail = errorText.slice(0, 200);
      }
      throw new Error(`QuickBooks rejected the invoice${detail ? `: ${detail}` : ''}`);
    }


    const qbResponse = await invoiceResponse.json();
    const qbInvoice = qbResponse.Invoice;
    const invoiceId = qbInvoice?.Id;
    const invoiceNumber = qbInvoice?.DocNumber;
    const invoiceUrl = `https://qbo.intuit.com/app/invoice?txnId=${invoiceId}`;

    // Customer-facing delivery: public share link + QuickBooks' own branded invoice email.
    const delivery = await prepareInvoiceDelivery(
      tokenData.access_token,
      tokenData.company_id,
      invoiceId,
      billingEmail,
      { fetchPdf: false }
    );

    console.log('QuickBooks invoice created:', invoiceNumber);

    // Update bicycle_inspections with invoice data
    const { error: updateError } = await supabase
      .from('bicycle_inspections')
      .update({
        invoice_number: invoiceNumber,
        invoice_id: invoiceId,
        invoice_url: invoiceUrl,
        invoice_public_url: delivery.publicUrl,
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
