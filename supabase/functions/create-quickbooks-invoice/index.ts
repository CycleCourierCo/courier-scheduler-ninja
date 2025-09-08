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
  jobs: Array<{
    id: string;
    created_at: string;
    order?: {
      tracking_number: string;
      bike_brand: string;
      bike_model: string;
      sender: any;
      receiver: any;
    };
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

    // Get OAuth access token for QuickBooks
    const clientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
    const clientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      throw new Error('QuickBooks credentials not configured');
    }

    // For now, we'll simulate the QuickBooks API call
    // In a real implementation, you would:
    // 1. Exchange OAuth tokens
    // 2. Create the invoice via QuickBooks API
    // 3. Send the invoice email

    const lineItems = invoiceData.jobs.map((job, index) => {
      const order = job.order;
      const senderName = order?.sender?.name || 'Unknown Sender';
      const receiverName = order?.receiver?.name || 'Unknown Receiver';
      
      return {
        line: index + 1,
        item: {
          itemId: "200000403",
          name: `Bike Transport Service - ${order?.tracking_number || job.id}`,
          description: `${order?.tracking_number || job.id} - ${order?.bike_brand || ''} ${order?.bike_model || ''} - ${senderName} → ${receiverName}`,
          quantity: 1,
          unitPrice: 50.00 // Default price - would be configurable
        },
        date: new Date(job.created_at).toISOString().split('T')[0]
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

    // TODO: Implement actual QuickBooks API integration
    // For now, we'll just log the invoice and return success
    
    return new Response(JSON.stringify({
      success: true,
      invoice: invoice,
      message: `Invoice created for ${invoiceData.customerName} with ${lineItems.length} line items`
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