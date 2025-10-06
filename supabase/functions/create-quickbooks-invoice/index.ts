import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvoiceRequest {
  customerId: string;
  customerEmail: string;
  customerName: string;
  startDate: string; // Should be in YYYY-MM-DD format
  endDate: string;   // Should be in YYYY-MM-DD format
  orders: Array<{
    id: string;
    created_at: string;
    tracking_number: string;
    bike_brand: string;
    bike_model: string;
    bike_quantity: number;
    customer_order_number: string;
    sender: any;
    receiver: any;
  }>;
}

async function refreshQuickBooksToken(
  supabase: any, 
  userId: string, 
  refreshToken: string
): Promise<{ access_token: string; expires_at: string } | null> {
  try {
    const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      console.error('QuickBooks credentials not configured');
      return null;
    }

    const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    
    const tokenParams = new URLSearchParams({
      'grant_type': 'refresh_token',
      'refresh_token': refreshToken
    });

    const credentials = btoa(`${clientId}:${clientSecret}`);
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
        'Accept': 'application/json'
      },
      body: tokenParams.toString()
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token refresh failed:', errorText);
      return null;
    }

    const tokenData = await tokenResponse.json();
    
    // Update tokens in database
    const newExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();
    
    const { error: updateError } = await supabase
      .from('quickbooks_tokens')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || refreshToken,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating tokens:', updateError);
      return null;
    }

    console.log('QuickBooks token refreshed successfully for user:', userId);
    
    return {
      access_token: tokenData.access_token,
      expires_at: newExpiresAt
    };

  } catch (error) {
    console.error('Error refreshing QuickBooks token:', error);
    return null;
  }
}

async function getValidQuickBooksToken(
  supabase: any, 
  userId: string
): Promise<{ access_token: string; company_id: string; expires_at: string } | null> {
  try {
    // Get current tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('quickbooks_tokens')
      .select('access_token, refresh_token, expires_at, company_id')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenData) {
      console.error('No QuickBooks tokens found for user:', userId);
      return null;
    }

    // Check if token is expired (with 5 minute buffer)
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    if (expiresAt.getTime() - now.getTime() < bufferTime) {
      console.log('Token expired or expiring soon, attempting refresh...');
      
      // Try to refresh the token
      const refreshResult = await refreshQuickBooksToken(
        supabase, 
        userId, 
        tokenData.refresh_token
      );
      
      if (refreshResult) {
        return {
          access_token: refreshResult.access_token,
          company_id: tokenData.company_id,
          expires_at: refreshResult.expires_at
        };
      } else {
        console.error('Failed to refresh token');
        return null;
      }
    }

    // Token is still valid
    return {
      access_token: tokenData.access_token,
      company_id: tokenData.company_id,
      expires_at: tokenData.expires_at
    };

  } catch (error) {
    console.error('Error getting valid QuickBooks token:', error);
    return null;
  }
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      throw new Error('Admin access required');
    }

    const invoiceData: InvoiceRequest = await req.json();
    console.log('Creating QuickBooks invoice for:', invoiceData.customerName);
    console.log('Date range:', invoiceData.startDate, 'to', invoiceData.endDate);

    // Get valid QuickBooks tokens (will auto-refresh if needed)
    const tokenData = await getValidQuickBooksToken(supabase, user.id);

    if (!tokenData) {
      throw new Error('QuickBooks not connected or refresh failed. Please reconnect to QuickBooks.');
    }

    // First, fetch available tax codes from QuickBooks
    const taxCodesUrl = `https://quickbooks.api.intuit.com/v3/company/${tokenData.company_id}/query?query=SELECT * FROM TaxCode`;
    
    const taxCodesResponse = await fetch(taxCodesUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    });

    let nonTaxableCode = "NON"; // Default fallback
    
    if (taxCodesResponse.ok) {
      const taxCodesData = await taxCodesResponse.json();
      console.log('Available tax codes:', taxCodesData);
      
      // Look for a non-taxable tax code
      const taxCodes = taxCodesData.QueryResponse?.TaxCode || [];
      const nonTaxable = taxCodes.find((code: any) => 
        code.Name?.toLowerCase().includes('non') || 
        code.Name?.toLowerCase().includes('zero') ||
        code.Name?.toLowerCase().includes('exempt') ||
        code.TaxRateRef?.value === "0"
      );
      
      if (nonTaxable) {
        nonTaxableCode = nonTaxable.Id;
        console.log('Using tax code:', nonTaxableCode, 'for', nonTaxable.Name);
      }
    } else {
      console.warn('Failed to fetch tax codes, using default NON');
    }

    // Query available items to find a valid service item
    const itemsUrl = `https://quickbooks.api.intuit.com/v3/company/${tokenData.company_id}/query?query=SELECT * FROM Item WHERE Type='Service' AND Active=true`;
    
    let serviceItemId = "1"; // Default fallback
    let serviceItemName = "Service";
    let serviceItemPrice = 50.00; // Default fallback
    
    const itemsResponse = await fetch(itemsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    });

    if (itemsResponse.ok) {
      const itemsData = await itemsResponse.json();
      console.log('Available service items:', itemsData);
      
      const items = itemsData.QueryResponse?.Item || [];
      
      // Look for "Collection and Delivery within England and Wales - Including B2B rebate" first
      const preferredItem = items.find((item: any) => 
        item.Name === "Collection and Delivery within England and Wales - Including B2B rebate" && item.Active === true
      );
      
      if (preferredItem) {
        serviceItemId = preferredItem.Id;
        serviceItemName = preferredItem.Name;
        serviceItemPrice = preferredItem.UnitPrice || 65.00;
        console.log('Using preferred B2B rebate item:', preferredItem);
      } else {
        // Fallback to first available service item
        const firstServiceItem = items.find((item: any) => 
          item.Type === 'Service' && item.Active === true
        );
        
        if (firstServiceItem) {
          serviceItemId = firstServiceItem.Id;
          serviceItemName = firstServiceItem.Name;
          serviceItemPrice = firstServiceItem.UnitPrice || 50.00;
          console.log('Using first available service item:', firstServiceItem);
        } else {
          console.log('No service items found, will use default');
        }
      }
    } else {
      console.warn('Failed to fetch items, using default service item');
    }

    // Query for sales terms to find "Net 7 days"
    const termsUrl = `https://quickbooks.api.intuit.com/v3/company/${tokenData.company_id}/query?query=SELECT * FROM Term WHERE Active=true`;
    
    let salesTermId = null;
    
    const termsResponse = await fetch(termsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    });

    if (termsResponse.ok) {
      const termsData = await termsResponse.json();
      console.log('Available terms:', termsData);
      
      const terms = termsData.QueryResponse?.Term || [];
      const net7Term = terms.find((term: any) => 
        term.Name?.toLowerCase().includes('net 7') || 
        term.Name?.toLowerCase().includes('7 days') ||
        (term.DueDays === 7)
      );
      
      if (net7Term) {
        salesTermId = net7Term.Id;
        console.log('Using term:', net7Term.Name, 'with ID:', salesTermId);
      }
    } else {
      console.warn('Failed to fetch terms');
    }

    // Query for the next invoice number
    const invoicesUrl = `https://quickbooks.api.intuit.com/v3/company/${tokenData.company_id}/query?query=SELECT DocNumber FROM Invoice ORDER BY DocNumber DESC MAXRESULTS 1`;
    
    let nextDocNumber = null;
    
    const invoicesResponse = await fetch(invoicesUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    });

    if (invoicesResponse.ok) {
      const invoicesData = await invoicesResponse.json();
      console.log('Latest invoice:', invoicesData);
      
      const invoices = invoicesData.QueryResponse?.Invoice || [];
      if (invoices.length > 0 && invoices[0].DocNumber) {
        const lastDocNumber = invoices[0].DocNumber;
        const numericPart = parseInt(lastDocNumber.replace(/\D/g, '')) || 0;
        nextDocNumber = (numericPart + 1).toString();
        console.log('Next invoice number will be:', nextDocNumber);
      } else {
        console.log('No previous invoices found or DocNumber missing, starting from 1');
        nextDocNumber = "1";
      }
    } else {
      console.warn('Failed to fetch latest invoice number');
    }

    const lineItems = invoiceData.orders.map((order, index) => {
      const senderName = order.sender?.name || 'Unknown Sender';
      const receiverName = order.receiver?.name || 'Unknown Receiver';
      const serviceDate = new Date(order.created_at).toISOString().split('T')[0];
      const quantity = order.bike_quantity || 1;
      const totalAmount = serviceItemPrice * quantity;
      
      console.log(`Processing order ${order.id}: quantity=${quantity}, unitPrice=${serviceItemPrice}, total=${totalAmount}`);
      
      // Build description with order number if available
      let description = `${order.tracking_number || order.id}`;
      if (order.customer_order_number) {
        description += ` (Order #${order.customer_order_number})`;
      }
      description += ` - ${order.bike_brand || ''} ${order.bike_model || ''} - ${senderName} → ${receiverName}`;
      
      return {
        Amount: totalAmount,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: {
            value: serviceItemId, // Use the found service item ID
            name: serviceItemName
          },
          Qty: quantity,
          UnitPrice: serviceItemPrice,
          TaxCodeRef: {
            value: nonTaxableCode // Use the fetched tax code
          },
          ServiceDate: serviceDate
        },
        Description: description
      };
    });

    const invoice = {
      customer: {
        id: invoiceData.customerId,
        name: invoiceData.customerName,
        email: invoiceData.customerEmail
      },
      invoiceDate: invoiceData.endDate, // Use exact end date selected
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
      terms: "7 days",
      lineItems: lineItems,
      totalAmount: lineItems.reduce((sum, item) => sum + item.Amount, 0)
    };

    console.log('Invoice created:', invoice);

    // First, find the customer in QuickBooks by email
    const customerEmail = invoiceData.customerEmail;
    const customerQueryUrl = `https://quickbooks.api.intuit.com/v3/company/${tokenData.company_id}/query?query=SELECT * FROM Customer WHERE PrimaryEmailAddr = '${customerEmail}'`;
    
    const customerResponse = await fetch(customerQueryUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    });

    let customerId = null;
    
    if (customerResponse.ok) {
      const customerData = await customerResponse.json();
      const customers = customerData.QueryResponse?.Customer || [];
      
      if (customers.length > 0) {
        customerId = customers[0].Id;
        console.log('Found existing customer:', customerId, 'for email:', customerEmail);
      } else {
        console.log('No customer found for email:', customerEmail);
        throw new Error(`Customer not found in QuickBooks for email: ${customerEmail}. Please create the customer first.`);
      }
    } else {
      console.error('Failed to query customers:', await customerResponse.text());
      throw new Error('Failed to query QuickBooks customers');
    }

    // Create invoice in QuickBooks using correct API format
    const quickbooksApiUrl = `https://quickbooks.api.intuit.com/v3/company/${tokenData.company_id}/invoice`;
    
    const quickbooksInvoice = {
      Line: lineItems,
      CustomerRef: {
        value: customerId
      },
      BillEmail: {
        Address: customerEmail
      },
      TxnDate: invoiceData.endDate, // Use exact end date
      ...(salesTermId && { SalesTermRef: { value: salesTermId } }),
      ...(nextDocNumber && { DocNumber: nextDocNumber })
    };

    const response = await fetch(quickbooksApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(quickbooksInvoice)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('QuickBooks API error:', errorText);
      throw new Error(`Failed to create invoice in QuickBooks: ${errorText}`);
    }

    const quickbooksResponse = await response.json();
    console.log('QuickBooks invoice created:', quickbooksResponse);

    // Extract QuickBooks invoice details
    const qbInvoice = quickbooksResponse.QueryResponse?.Invoice?.[0] || quickbooksResponse.Invoice;
    const invoiceId = qbInvoice?.Id;
    const invoiceNumber = qbInvoice?.DocNumber;
    
    // Generate QuickBooks invoice URL (for production)
    const invoiceUrl = `https://qbo.intuit.com/app/invoice?txnId=${invoiceId}`;

    // Save invoice history to database
    const { error: historyError } = await supabase
      .from('invoice_history')
      .insert({
        user_id: user.id,
        customer_id: invoiceData.customerId,
        customer_name: invoiceData.customerName,
        customer_email: invoiceData.customerEmail,
        start_date: invoiceData.startDate,
        end_date: invoiceData.endDate,
        order_count: invoiceData.orders.length,
        total_amount: invoice.totalAmount,
        quickbooks_invoice_id: invoiceId,
        quickbooks_invoice_number: invoiceNumber,
        quickbooks_invoice_url: invoiceUrl,
        status: 'created'
      });

    if (historyError) {
      console.error('Error saving invoice history:', historyError);
      // Don't fail the whole operation if history save fails
    }
    
    return new Response(JSON.stringify({
      success: true,
      invoice: invoice,
      quickbooksInvoice: quickbooksResponse,
      message: `Invoice created in QuickBooks for ${invoiceData.customerName} with ${lineItems.length} line items`
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error creating QuickBooks invoice:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to create invoice',
        details: error.toString()
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);