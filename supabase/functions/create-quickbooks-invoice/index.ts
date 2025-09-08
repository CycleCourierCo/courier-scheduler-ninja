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
  startDate: string;
  endDate: string;
  orders: Array<{
    id: string;
    created_at: string;
    tracking_number: string;
    bike_brand: string;
    bike_model: string;
    sender: any;
    receiver: any;
  }>;
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

    // Get stored QuickBooks tokens for the current user
    const { data: tokenData, error: tokenError } = await supabase
      .from('quickbooks_tokens')
      .select('access_token, refresh_token, expires_at, company_id')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      throw new Error('QuickBooks not connected. Please connect to QuickBooks first.');
    }

    // Check if token is expired
    if (new Date(tokenData.expires_at) <= new Date()) {
      throw new Error('QuickBooks token expired. Please reconnect to QuickBooks.');
    }

    // First, fetch available tax codes from QuickBooks
    const taxCodesUrl = `https://sandbox-quickbooks.api.intuit.com/v3/company/${tokenData.company_id}/query?query=SELECT * FROM TaxCode`;
    
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

    const lineItems = invoiceData.orders.map((order, index) => {
      const senderName = order.sender?.name || 'Unknown Sender';
      const receiverName = order.receiver?.name || 'Unknown Receiver';
      
      return {
        Amount: 50.00, // Default price - would be configurable
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: {
            value: "1", // Default service item - would need to be configured
            name: "Service"
          },
          Qty: 1,
          UnitPrice: 50.00,
          TaxCodeRef: {
            value: nonTaxableCode
          }
        },
        Description: `${order.tracking_number || order.id} - ${order.bike_brand || ''} ${order.bike_model || ''} - ${senderName} → ${receiverName}`
      };
    });

    const invoice = {
      customer: {
        id: invoiceData.customerId,
        name: invoiceData.customerName,
        email: invoiceData.customerEmail
      },
      invoiceDate: new Date(invoiceData.endDate).toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 15 days from now
      terms: "15 days",
      lineItems: lineItems,
      totalAmount: lineItems.length * 50.00
    };

    console.log('Invoice created:', invoice);

    // Create invoice in QuickBooks using correct API format
    const quickbooksApiUrl = `https://sandbox-quickbooks.api.intuit.com/v3/company/${tokenData.company_id}/invoice`;
    
    const quickbooksInvoice = {
      Line: lineItems,
      CustomerRef: {
        value: "1" // Would need to create/lookup customer in QuickBooks
      }
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