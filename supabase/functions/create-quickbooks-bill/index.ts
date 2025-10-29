import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

interface BillRequest {
  timeslipId: string;
  driverId: string;
  driverName: string;
  driverEmail: string;
  date: string;
  totalPay: number;
  breakdown: {
    drivingHours: number;
    stopHours: number;
    lunchHours: number;
    hourlyRate: number;
    vanAllowance: number;
    customAddonHours: number;
  };
}

interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

async function refreshQuickBooksToken(
  supabase: any,
  userId: string,
  refreshToken: string
): Promise<{ access_token: string; expires_at: string } | null> {
  const clientId = Deno.env.get("QUICKBOOKS_CLIENT_ID");
  const clientSecret = Deno.env.get("QUICKBOOKS_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    console.error("Missing QuickBooks credentials");
    return null;
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);

  try {
    const response = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Token refresh failed:", response.status, errorText);
      return null;
    }

    const data: RefreshTokenResponse = await response.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    await supabase
      .from("quickbooks_tokens")
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return {
      access_token: data.access_token,
      expires_at: expiresAt,
    };
  } catch (error) {
    console.error("Error refreshing token:", error);
    return null;
  }
}

async function getValidQuickBooksToken(
  supabase: any,
  userId: string
): Promise<{ access_token: string; company_id: string; expires_at: string } | null> {
  const { data: tokenData, error } = await supabase
    .from("quickbooks_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !tokenData) {
    console.error("No QuickBooks token found for user");
    return null;
  }

  const expiresAt = new Date(tokenData.expires_at);
  const now = new Date();
  const bufferTime = 5 * 60 * 1000; // 5 minutes buffer

  if (expiresAt.getTime() - now.getTime() < bufferTime) {
    console.log("Token expired or expiring soon, refreshing...");
    const refreshed = await refreshQuickBooksToken(
      supabase,
      userId,
      tokenData.refresh_token
    );

    if (!refreshed) {
      return null;
    }

    return {
      access_token: refreshed.access_token,
      company_id: tokenData.company_id,
      expires_at: refreshed.expires_at,
    };
  }

  return {
    access_token: tokenData.access_token,
    company_id: tokenData.company_id,
    expires_at: tokenData.expires_at,
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const requestData: BillRequest = await req.json();
    console.log("Creating QuickBooks bill for timeslip:", requestData.timeslipId);

    // Get QuickBooks token (using admin's token - first admin user)
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .limit(1)
      .single();

    if (!adminProfile) {
      throw new Error("No admin user found");
    }

    const tokenData = await getValidQuickBooksToken(supabase, adminProfile.id);
    if (!tokenData) {
      throw new Error("Failed to get valid QuickBooks token");
    }

    const { access_token, company_id } = tokenData;
    const baseUrl = `https://quickbooks.api.intuit.com/v3/company/${company_id}`;

    // Find vendor by email
    console.log("Searching for vendor with email:", requestData.driverEmail);
    const vendorQueryUrl = `${baseUrl}/query?query=SELECT * FROM Vendor WHERE PrimaryEmailAddr = '${requestData.driverEmail}'&minorversion=65`;
    
    const vendorResponse = await fetch(vendorQueryUrl, {
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Accept": "application/json",
      },
    });

    if (!vendorResponse.ok) {
      const errorText = await vendorResponse.text();
      console.error("Vendor query failed:", errorText);
      throw new Error(`Vendor not found for email: ${requestData.driverEmail}. Please create the driver as a vendor in QuickBooks.`);
    }

    const vendorData = await vendorResponse.json();
    if (!vendorData.QueryResponse?.Vendor || vendorData.QueryResponse.Vendor.length === 0) {
      throw new Error(`Vendor not found for email: ${requestData.driverEmail}. Please create the driver as a vendor in QuickBooks.`);
    }

    const vendorId = vendorData.QueryResponse.Vendor[0].Id;
    console.log("Found vendor ID:", vendorId);

    // Find expense account
    const accountQueryUrl = `${baseUrl}/query?query=SELECT * FROM Account WHERE AccountType='Expense' AND Active=true&minorversion=65`;
    
    const accountResponse = await fetch(accountQueryUrl, {
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Accept": "application/json",
      },
    });

    if (!accountResponse.ok) {
      throw new Error("Failed to query expense accounts");
    }

    const accountData = await accountResponse.json();
    const expenseAccount = accountData.QueryResponse?.Account?.[0];
    
    if (!expenseAccount) {
      throw new Error("No expense account found in QuickBooks");
    }

    const expenseAccountId = expenseAccount.Id;
    console.log("Using expense account:", expenseAccount.Name);

    // Build line items
    const lineItems = [];
    const { breakdown } = requestData;

    if (breakdown.drivingHours > 0) {
      lineItems.push({
        Amount: breakdown.drivingHours * breakdown.hourlyRate,
        DetailType: "AccountBasedExpenseLineDetail",
        AccountBasedExpenseLineDetail: {
          AccountRef: { value: expenseAccountId },
        },
        Description: `Driving Hours: ${breakdown.drivingHours.toFixed(2)} hrs @ £${breakdown.hourlyRate.toFixed(2)}/hr`,
      });
    }

    if (breakdown.stopHours > 0) {
      lineItems.push({
        Amount: breakdown.stopHours * breakdown.hourlyRate,
        DetailType: "AccountBasedExpenseLineDetail",
        AccountBasedExpenseLineDetail: {
          AccountRef: { value: expenseAccountId },
        },
        Description: `Stop Hours: ${breakdown.stopHours.toFixed(2)} hrs @ £${breakdown.hourlyRate.toFixed(2)}/hr`,
      });
    }

    if (breakdown.lunchHours > 0) {
      lineItems.push({
        Amount: breakdown.lunchHours * breakdown.hourlyRate,
        DetailType: "AccountBasedExpenseLineDetail",
        AccountBasedExpenseLineDetail: {
          AccountRef: { value: expenseAccountId },
        },
        Description: `Lunch Hours: ${breakdown.lunchHours.toFixed(2)} hrs @ £${breakdown.hourlyRate.toFixed(2)}/hr`,
      });
    }

    if (breakdown.vanAllowance > 0) {
      lineItems.push({
        Amount: breakdown.vanAllowance,
        DetailType: "AccountBasedExpenseLineDetail",
        AccountBasedExpenseLineDetail: {
          AccountRef: { value: expenseAccountId },
        },
        Description: "Van Allowance",
      });
    }

    if (breakdown.customAddonHours > 0) {
      lineItems.push({
        Amount: breakdown.customAddonHours * breakdown.hourlyRate,
        DetailType: "AccountBasedExpenseLineDetail",
        AccountBasedExpenseLineDetail: {
          AccountRef: { value: expenseAccountId },
        },
        Description: `Custom Add-ons: ${breakdown.customAddonHours.toFixed(2)} hrs @ £${breakdown.hourlyRate.toFixed(2)}/hr`,
      });
    }

    // Calculate due date (7 days from today)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    // Create bill
    const billPayload = {
      VendorRef: { value: vendorId },
      TxnDate: requestData.date,
      DueDate: dueDateStr,
      Line: lineItems,
      PrivateNote: `Timeslip for ${requestData.driverName} - ${requestData.date}`,
    };

    console.log("Creating bill with payload:", JSON.stringify(billPayload, null, 2));

    const billResponse = await fetch(`${baseUrl}/bill?minorversion=65`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(billPayload),
    });

    if (!billResponse.ok) {
      const errorText = await billResponse.text();
      console.error("Bill creation failed:", errorText);
      throw new Error(`Failed to create bill: ${errorText}`);
    }

    const billData = await billResponse.json();
    const bill = billData.Bill;

    console.log("Bill created successfully:", bill.Id);

    // Update timeslip with QuickBooks bill info
    const { error: updateError } = await supabase
      .from("timeslips")
      .update({
        quickbooks_bill_id: bill.Id,
        quickbooks_bill_number: bill.DocNumber,
        quickbooks_bill_url: `https://app.qbo.intuit.com/app/bill?txnId=${bill.Id}`,
        quickbooks_bill_created_at: new Date().toISOString(),
      })
      .eq("id", requestData.timeslipId);

    if (updateError) {
      console.error("Failed to update timeslip:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        billId: bill.Id,
        billNumber: bill.DocNumber,
        message: "QuickBooks bill created successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in create-quickbooks-bill:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
