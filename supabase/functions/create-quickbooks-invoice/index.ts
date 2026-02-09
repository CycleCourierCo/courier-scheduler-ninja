import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BikeItem {
  brand: string;
  model: string;
  type: string;
}

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
    bike_type: string;
    bike_quantity: number;
    bikes: BikeItem[] | null;
    customer_order_number: string;
    sender: any;
    receiver: any;
  }>;
}

interface ProductInfo {
  id: string;
  name: string;
  price: number;
}

// Map legacy bike types to current QuickBooks product names
function normalizeBikeType(bikeType: string): string {
  const legacyMappings: Record<string, string> = {
    'Electric Bikes': 'Electric Bike - Under 25kg',
    'Non-Electric Bikes': 'Non-Electric Bikes',
  };
  
  return legacyMappings[bikeType] || bikeType;
}

// Escape a string for safe use inside a single-quoted QuickBooks query literal.
// This escapes backslashes first, then single quotes.
function escapeQuickBooksString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// Cache for product lookups to avoid repeated API calls
const productCache = new Map<string, ProductInfo | null>();

async function findProductByBikeType(
  accessToken: string, 
  companyId: string, 
  bikeType: string
): Promise<ProductInfo | null> {
  // Check cache first
  if (productCache.has(bikeType)) {
    console.log(`Using cached product for bike type: ${bikeType}`);
    return productCache.get(bikeType) || null;
  }

  const productName = `Collection and Delivery within England and Wales - ${bikeType}`;
  console.log(`Looking up QuickBooks product: ${productName}`);
  
  // QuickBooks query needs proper escaping for backslashes and single quotes
  const escapedProductName = escapeQuickBooksString(productName);
  const query = `SELECT * FROM Item WHERE Name = '${escapedProductName}' AND Active=true`;
  
  const response = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${companyId}/query?query=${encodeURIComponent(query)}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    }
  );

  if (response.ok) {
    const data = await response.json();
    const item = data.QueryResponse?.Item?.[0];
    
    if (item) {
      const product: ProductInfo = { 
        id: item.Id, 
        name: item.Name, 
        price: item.UnitPrice || 0
      };
      console.log(`Found product for ${bikeType}: ID=${product.id}, Price=${product.price}`);
      productCache.set(bikeType, product);
      return product;
    } else {
      console.warn(`No product found for bike type: ${bikeType}`);
      productCache.set(bikeType, null);
    }
  } else {
    const errorText = await response.text();
    console.error(`Error querying product for ${bikeType}:`, errorText);
  }
  
  return null;
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
    const { data: tokenData, error: tokenError } = await supabase
      .from('quickbooks_tokens')
      .select('access_token, refresh_token, expires_at, company_id')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenData) {
      console.error('No QuickBooks tokens found for user:', userId);
      return null;
    }

    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    const bufferTime = 5 * 60 * 1000;
    
    if (expiresAt.getTime() - now.getTime() < bufferTime) {
      console.log('Token expired or expiring soon, attempting refresh...');
      
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Clear product cache for each request to get fresh prices
    productCache.clear();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

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
    console.log('Total orders:', invoiceData.orders.length);

    const tokenData = await getValidQuickBooksToken(supabase, user.id);

    if (!tokenData) {
      throw new Error('QuickBooks not connected or refresh failed. Please reconnect to QuickBooks.');
    }

    // Query for sales terms
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

    // Query for VAT tax code (UK 20% standard rate)
    let vatTaxCodeId: string | null = null;
    
    const taxCodeUrl = `https://quickbooks.api.intuit.com/v3/company/${tokenData.company_id}/query?query=SELECT * FROM TaxCode WHERE Active=true`;
    
    const taxCodeResponse = await fetch(taxCodeUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    });

    if (taxCodeResponse.ok) {
      const taxCodeData = await taxCodeResponse.json();
      console.log('Available tax codes:', JSON.stringify(taxCodeData, null, 2));
      
      const taxCodes = taxCodeData.QueryResponse?.TaxCode || [];
      // Look for standard UK VAT rate (20%) - try various common names
      const vatCode = taxCodes.find((code: any) => 
        code.Name === '20.0% S' ||
        code.Name === '20% S' ||
        code.Name === 'Standard' ||
        code.Name?.includes('20%') ||
        code.Name?.toLowerCase().includes('standard')
      );
      
      if (vatCode) {
        vatTaxCodeId = vatCode.Id;
        console.log('Using VAT tax code:', vatCode.Name, 'with ID:', vatTaxCodeId);
      } else {
        // Fall back to any taxable code (not zero/exempt)
        const anyTaxableCode = taxCodes.find((code: any) => 
          !code.Name?.toLowerCase().includes('zero') &&
          !code.Name?.toLowerCase().includes('exempt') &&
          !code.Name?.toLowerCase().includes('non') &&
          code.Taxable === true
        );
        if (anyTaxableCode) {
          vatTaxCodeId = anyTaxableCode.Id;
          console.log('Using fallback taxable code:', anyTaxableCode.Name, 'with ID:', vatTaxCodeId);
        } else {
          console.warn('No suitable VAT tax code found, invoice may fail');
        }
      }
    } else {
      console.warn('Failed to fetch tax codes:', await taxCodeResponse.text());
    }

    // Check for special rate code on customer profile
    let specialRateProduct: ProductInfo | null = null;
    let specialRateCode: string | null = null;
    
    const { data: customerProfile, error: customerProfileError } = await supabase
      .from('profiles')
      .select('special_rate_code')
      .eq('id', invoiceData.customerId)
      .single();
    
    if (customerProfileError) {
      console.warn('Could not fetch customer profile for special rate check:', customerProfileError.message);
    } else if (customerProfile?.special_rate_code) {
      specialRateCode = customerProfile.special_rate_code.trim();
      if (specialRateCode) {
        console.log(`Customer has special rate code: ${specialRateCode}`);
        specialRateProduct = await findProductByBikeType(
          tokenData.access_token, 
          tokenData.company_id, 
          `Special Rate - ${specialRateCode}`
        );
        
        if (!specialRateProduct) {
          throw new Error(
            `Special rate product not found in QuickBooks: ` +
            `"Collection and Delivery within England and Wales - Special Rate - ${specialRateCode}". ` +
            `Please create this product in QuickBooks first.`
          );
        }
        console.log(`Using special rate product: ${specialRateProduct.name} @ £${specialRateProduct.price}`);
      }
    }

    // Build line items with bike-type-based pricing (or special rate if set)
    const lineItems: any[] = [];
    const missingProducts: string[] = [];
    
    for (const order of invoiceData.orders) {
      const senderName = order.sender?.name || 'Unknown Sender';
      const receiverName = order.receiver?.name || 'Unknown Receiver';
      const serviceDate = new Date(order.created_at).toISOString().split('T')[0];
      
      // Determine bikes to process
      let bikesToProcess: BikeItem[];
      
      if (order.bikes && Array.isArray(order.bikes) && order.bikes.length > 0) {
        // New multi-bike orders with structured data
        bikesToProcess = order.bikes;
        console.log(`Order ${order.tracking_number}: Using structured bikes array with ${bikesToProcess.length} bikes`);
      } else if (order.bike_type) {
        // Legacy orders - use bike_type field
        const quantity = order.bike_quantity || 1;
        bikesToProcess = Array(quantity).fill({
          brand: order.bike_brand || '',
          model: order.bike_model || '',
          type: order.bike_type
        });
        console.log(`Order ${order.tracking_number}: Legacy order with ${quantity} bikes of type ${order.bike_type}`);
      } else {
        // Fallback - create a single entry with whatever we have
        console.warn(`Order ${order.tracking_number}: No bike type found, skipping product lookup`);
        bikesToProcess = [{
          brand: order.bike_brand || '',
          model: order.bike_model || '',
          type: 'Unknown'
        }];
      }
      
      // Create line items for each bike
      for (let i = 0; i < bikesToProcess.length; i++) {
        const bike = bikesToProcess[i];
        
        // Use special rate product if customer has one, otherwise look up by bike type
        let product: ProductInfo | null = null;
        
        if (specialRateProduct) {
          // Use special rate for ALL bikes when customer has special rate code
          product = specialRateProduct;
        } else {
          // Normalize legacy bike type names and look up product
          const normalizedType = normalizeBikeType(bike.type);
          product = normalizedType && normalizedType !== 'Unknown' 
            ? await findProductByBikeType(tokenData.access_token, tokenData.company_id, normalizedType)
            : null;
          
          if (!product && normalizedType && normalizedType !== 'Unknown') {
            if (!missingProducts.includes(normalizedType)) {
              missingProducts.push(normalizedType);
            }
            console.warn(`Skipping line item for ${order.tracking_number} - no product found for bike type: ${bike.type} (normalized: ${normalizedType})`);
            continue;
          }
          
          // If no product found at all, skip this bike
          if (!product) {
            console.warn(`Skipping bike ${i + 1} in order ${order.tracking_number} - no product available`);
            continue;
          }
        }
        
        // Build description
        let description = `${order.tracking_number || order.id}`;
        if (order.customer_order_number) {
          description += ` (Order #${order.customer_order_number})`;
        }
        if (bike.brand || bike.model) {
          description += ` - ${bike.brand || ''} ${bike.model || ''}`.trim();
        }
        description += ` - ${senderName} → ${receiverName}`;
        
        lineItems.push({
          Amount: product.price,
          DetailType: "SalesItemLineDetail",
          SalesItemLineDetail: {
            ItemRef: {
              value: product.id,
              name: product.name
            },
            Qty: 1,
            UnitPrice: product.price,
            ServiceDate: serviceDate,
            ...(vatTaxCodeId && { TaxCodeRef: { value: vatTaxCodeId } })
          },
          Description: description
        });
        
        console.log(`Added line item: ${description} @ £${product.price}`);
      }
    }
    
    // Check if we have any line items
    if (lineItems.length === 0) {
      const errorMsg = missingProducts.length > 0 
        ? `No line items could be created. Missing QuickBooks products for bike types: ${missingProducts.join(', ')}`
        : 'No line items could be created. Please ensure orders have bike types set.';
      throw new Error(errorMsg);
    }
    
    // Log any missing products as a warning
    if (missingProducts.length > 0) {
      console.warn(`Missing QuickBooks products for bike types: ${missingProducts.join(', ')}`);
    }

    const invoice = {
      customer: {
        id: invoiceData.customerId,
        name: invoiceData.customerName,
        email: invoiceData.customerEmail
      },
      invoiceDate: invoiceData.endDate,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      terms: "7 days",
      lineItems: lineItems,
      totalAmount: lineItems.reduce((sum, item) => sum + item.Amount, 0)
    };

    console.log('Invoice created with', lineItems.length, 'line items, total:', invoice.totalAmount);

    // Find customer in QuickBooks
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

    // Create invoice in QuickBooks
    const quickbooksApiUrl = `https://quickbooks.api.intuit.com/v3/company/${tokenData.company_id}/invoice`;
    
    const quickbooksInvoice = {
      Line: lineItems,
      CustomerRef: {
        value: customerId
      },
      BillEmail: {
        Address: customerEmail
      },
      TxnDate: invoiceData.endDate,
      ...(salesTermId && { SalesTermRef: { value: salesTermId } })
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

    const qbInvoice = quickbooksResponse.QueryResponse?.Invoice?.[0] || quickbooksResponse.Invoice;
    const invoiceId = qbInvoice?.Id;
    const invoiceNumber = qbInvoice?.DocNumber;
    
    const invoiceUrl = `https://qbo.intuit.com/app/invoice?txnId=${invoiceId}`;

    // Save invoice history
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
    }

    // Calculate stats for reporting
    const totalBikesInOrders = invoiceData.orders.reduce((count, order) => {
      const bikesInOrder = order.bikes?.length || order.bike_quantity || 1;
      return count + bikesInOrder;
    }, 0);
    const skippedBikes = totalBikesInOrders - lineItems.length;

    // Send email report after successful invoice creation
    try {
      const reportHtml = `
        <h2>QuickBooks Invoice Created</h2>
        <p><strong>Customer:</strong> ${invoiceData.customerName}</p>
        <p><strong>Email:</strong> ${invoiceData.customerEmail}</p>
        <p><strong>Invoice Number:</strong> ${invoiceNumber || 'N/A'}</p>
        <p><strong>Date Range:</strong> ${invoiceData.startDate.split('T')[0]} to ${invoiceData.endDate.split('T')[0]}</p>
        
        <h3>Summary</h3>
        <ul>
          <li>Orders: ${invoiceData.orders.length}</li>
          <li>Line Items (Bikes): ${lineItems.length}</li>
          ${skippedBikes > 0 ? `<li style="color: #dc2626;">Skipped Bikes: ${skippedBikes}</li>` : ''}
          <li>Total Amount: £${invoice.totalAmount.toFixed(2)}</li>
        </ul>
        
        ${missingProducts.length > 0 ? `
          <h3 style="color: #dc2626;">⚠️ Missing QuickBooks Products</h3>
          <p>The following bike types could not be matched to QuickBooks products:</p>
          <ul>
            ${missingProducts.map(p => `<li>${p}</li>`).join('')}
          </ul>
          <p><strong>Action Required:</strong> Create these products in QuickBooks with the naming format:<br>
          "Collection and Delivery within England and Wales - [Bike Type]"</p>
        ` : '<p style="color: #16a34a;">✓ All bike types matched to QuickBooks products</p>'}
        
        <p><a href="${invoiceUrl}">View Invoice in QuickBooks</a></p>
      `;

      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          to: 'info@cyclecourierco.com',
          subject: `Invoice Created: ${invoiceData.customerName} - ${invoiceNumber || 'Draft'}`,
          html: reportHtml
        })
      });
      console.log('Invoice report email sent successfully');
    } catch (emailError) {
      console.error('Failed to send invoice report email:', emailError);
      // Don't fail the request if email fails
    }
    
    return new Response(JSON.stringify({
      success: true,
      invoice: invoice,
      quickbooksInvoice: quickbooksResponse,
      message: `Invoice created in QuickBooks for ${invoiceData.customerName} with ${lineItems.length} line items`,
      missingProducts: missingProducts.length > 0 ? missingProducts : undefined,
      stats: {
        orderCount: invoiceData.orders.length,
        bikeCount: lineItems.length,
        skippedBikes: skippedBikes,
        totalAmount: invoice.totalAmount,
        invoiceNumber: invoiceNumber,
        invoiceUrl: invoiceUrl
      }
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
