import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, FileText, Send, ExternalLink, Eye, Filter, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";

type Customer = {
  id: string;
  name: string;
  email: string;
  accounts_email?: string;
};

type BikeItem = {
  brand: string;
  model: string;
  type: string;
};

type InvoiceItem = {
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
  needs_inspection: boolean | null;
};

type InvoiceHistory = {
  id: string;
  customer_name: string;
  customer_email: string;
  start_date: string;
  end_date: string;
  order_count: number;
  total_amount: number;
  quickbooks_invoice_number: string;
  quickbooks_invoice_url: string;
  status: string;
  created_at: string;
};

export default function InvoicesPage() {
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [isConnectingQuickBooks, setIsConnectingQuickBooks] = useState(false);
  const [quickBooksConnected, setQuickBooksConnected] = useState(false);
  const [isCreatingAllInvoices, setIsCreatingAllInvoices] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  
  // Invoice history filters
  const [historyCustomerFilter, setHistoryCustomerFilter] = useState<string>("all");
  const [historyStartDate, setHistoryStartDate] = useState<Date>();
  const [historyEndDate, setHistoryEndDate] = useState<Date>();
  
  const { toast } = useToast();

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, accounts_email")
        .eq("role", "b2b_customer")
        .eq("account_status", "approved")
        .order("name");
      
      if (error) throw error;
      return data as Customer[];
    },
  });

  // Check QuickBooks connection status
  const { data: quickBooksToken } = useQuery({
    queryKey: ['quickbooks-token'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('quickbooks_tokens')
        .select('expires_at, refresh_token, created_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Fetch invoice history with filters
  const { data: invoiceHistory, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['invoice-history', historyCustomerFilter, historyStartDate, historyEndDate],
    queryFn: async () => {
      let query = supabase
        .from('invoice_history')
        .select('*');

      // Apply customer filter
      if (historyCustomerFilter && historyCustomerFilter !== "all") {
        query = query.eq('customer_id', historyCustomerFilter);
      }

      // Apply date filters
      if (historyStartDate && historyStartDate instanceof Date && !isNaN(historyStartDate.getTime())) {
        query = query.gte('created_at', historyStartDate.toISOString());
      }
      if (historyEndDate && historyEndDate instanceof Date && !isNaN(historyEndDate.getTime())) {
        const endOfDay = new Date(historyEndDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data as InvoiceHistory[];
    },
  });

  useEffect(() => {
    // Consider connected if token exists (refresh token is valid for 100 days)
    // The access token will be auto-refreshed by the edge function when needed
    if (quickBooksToken && quickBooksToken.refresh_token) {
      setQuickBooksConnected(true);
    } else {
      setQuickBooksConnected(false);
    }
  }, [quickBooksToken]);

  const { data: orders, isLoading: ordersLoading, error: ordersError } = useQuery({
    queryKey: ["orders-for-invoice", selectedCustomer, startDate, endDate],
    queryFn: async () => {
      if (!selectedCustomer || !startDate || !endDate) return [];
      
      console.log("Fetching orders for invoice:", { selectedCustomer, startDate: startDate.toISOString(), endDate: endDate.toISOString() });
      
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          tracking_number,
          bike_brand,
          bike_model,
          bike_type,
          bike_quantity,
          bikes,
          customer_order_number,
          sender,
          receiver,
          needs_inspection
        `)
        .eq("user_id", selectedCustomer)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .neq("status", "cancelled")
        .order("created_at");
      
      console.log("Orders query result:", { data, error });
      if (error) throw error;
      return data as InvoiceItem[];
    },
    enabled: !!(selectedCustomer && startDate && endDate),
  });

  const selectedCustomerData = customers?.find(c => c.id === selectedCustomer);

  const handleConnectQuickBooks = async () => {
    setIsConnectingQuickBooks(true);
    try {
      const { data, error } = await supabase.functions.invoke('quickbooks-oauth-init');
      
      if (error) throw error;
      
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (error: any) {
      console.error('Error connecting to QuickBooks:', error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to QuickBooks",
        variant: "destructive",
      });
    } finally {
      setIsConnectingQuickBooks(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm("Are you sure you want to delete this invoice? This action cannot be undone.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from('invoice_history')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;

      toast({
        title: "Invoice Deleted",
        description: "The invoice has been deleted successfully.",
      });

      // Refresh the invoice history
      refetchHistory();
    } catch (error: any) {
      console.error('Error deleting invoice:', error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete invoice",
        variant: "destructive",
      });
    }
  };

  console.log("Debug invoice button state:", {
    selectedCustomer,
    startDate,
    endDate,
    orders,
    ordersLength: orders?.length,
    selectedCustomerData,
    accountsEmail: selectedCustomerData?.accounts_email,
    isCreatingInvoice
  });

  const handleCreateInvoice = async () => {
    if (!selectedCustomerData || !orders || orders.length === 0 || !startDate || !endDate) {
      toast({
        title: "Missing Information",
        description: "Please select a customer, date range, and ensure there are orders to invoice.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedCustomerData.accounts_email) {
      toast({
        title: "Missing Accounts Email",
        description: "Customer must have an accounts email address set up for invoicing.",
        variant: "destructive",
      });
      return;
    }

    if (!quickBooksConnected) {
      toast({
        title: "QuickBooks Not Connected",
        description: "Please connect to QuickBooks before creating invoices.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingInvoice(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-quickbooks-invoice", {
        body: {
          customerId: selectedCustomer,
          customerEmail: selectedCustomerData.accounts_email,
          customerName: selectedCustomerData.name,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          orders: orders,
        },
      });

      if (error) throw error;

      toast({
        title: "Invoice Created",
        description: `QuickBooks invoice has been sent to ${selectedCustomerData.accounts_email}`,
      });

      // Refetch invoice history to show the new invoice
      refetchHistory();

    } catch (error: any) {
      console.error("Error creating invoice:", error);
      toast({
        title: "Error Creating Invoice",
        description: error.message || "Failed to create QuickBooks invoice",
        variant: "destructive",
      });
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  const handleCreateAllInvoices = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Missing Date Range",
        description: "Please select start and end dates.",
        variant: "destructive",
      });
      return;
    }

    if (!quickBooksConnected) {
      toast({
        title: "QuickBooks Not Connected",
        description: "Please connect to QuickBooks before creating invoices.",
        variant: "destructive",
      });
      return;
    }

    const eligibleCustomers = customers?.filter(c => c.accounts_email) || [];
    const customersWithoutEmail = customers?.filter(c => !c.accounts_email) || [];
    
    if (eligibleCustomers.length === 0) {
      toast({
        title: "No Eligible Customers",
        description: "No customers with accounts email found.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingAllInvoices(true);
    setBatchProgress({ current: 0, total: eligibleCustomers.length });

    const successfulInvoices: any[] = [];
    const failedInvoices: any[] = [];
    const allOrdersData: any[] = [];
    const skippedCustomers: any[] = [];
    const allMissingProducts: { product: string; customerName: string }[] = [];

    for (let i = 0; i < eligibleCustomers.length; i++) {
      const customer = eligibleCustomers[i];
      setBatchProgress({ current: i + 1, total: eligibleCustomers.length });

      try {
        // Fetch orders for this customer
        const { data: customerOrders, error: ordersError } = await supabase
          .from("orders")
          .select("*")
          .eq("user_id", customer.id)
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString())
          .neq("status", "cancelled");

        if (ordersError) throw ordersError;

        // Skip if no orders
        if (!customerOrders || customerOrders.length === 0) {
          console.log(`Skipping ${customer.name} - no orders found`);
          skippedCustomers.push({
            customerName: customer.name,
            customerEmail: customer.accounts_email || customer.email,
            reason: 'No orders in date range',
            orderCount: 0,
          });
          continue;
        }

        // Store all orders for statistics
        allOrdersData.push(...customerOrders);

        // Create invoice
        const { data, error } = await supabase.functions.invoke("create-quickbooks-invoice", {
          body: {
            customerId: customer.id,
            customerEmail: customer.accounts_email,
            customerName: customer.name,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            orders: customerOrders,
          },
        });

        if (error) throw error;

        // Track missing products for this invoice
        if (data?.missingProducts && Array.isArray(data.missingProducts)) {
          for (const product of data.missingProducts) {
            allMissingProducts.push({ product, customerName: customer.name });
          }
        }

        successfulInvoices.push({
          customerName: customer.name,
          customerEmail: customer.accounts_email,
          orderCount: customerOrders.length,
          bikeCount: data?.stats?.bikeCount || customerOrders.length,
          skippedBikes: data?.stats?.skippedBikes || 0,
          invoiceNumber: data?.stats?.invoiceNumber || data?.invoice_number,
          missingProducts: data?.missingProducts || [],
        });

        toast({
          title: "Invoice Created",
          description: `Invoice for ${customer.name} created successfully`,
        });

      } catch (error: any) {
        console.error(`Error creating invoice for ${customer.name}:`, error);
        failedInvoices.push({
          customerName: customer.name,
          customerEmail: customer.accounts_email || customer.email,
          error: error.message,
        });

        toast({
          title: "Invoice Failed",
          description: `Failed to create invoice for ${customer.name}`,
          variant: "destructive",
        });
      }
    }

    // Add customers without accounts_email to skipped list
    for (const customer of customersWithoutEmail) {
      // Check if they have orders in the date range
      const { data: customerOrders } = await supabase
        .from("orders")
        .select("id")
        .eq("user_id", customer.id)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .neq("status", "cancelled");

      const orderCount = customerOrders?.length || 0;
      
      skippedCustomers.push({
        customerName: customer.name,
        customerEmail: customer.email || 'No email',
        reason: 'Missing accounts email',
        orderCount,
      });
    }

    // Calculate statistics
    const deliveredOrders = allOrdersData.filter(o => o.status === 'delivered');
    const collectedOrders = allOrdersData.filter(o => o.sender_confirmed_at || o.status === 'collected' || o.status === 'in_transit' || o.status === 'delivered');
    
    const deliveryTimes = deliveredOrders
      .filter(o => o.created_at && o.tracking_events?.shipday?.updates)
      .map(o => {
        const createdAt = new Date(o.created_at);
        const deliveredEvent = o.tracking_events.shipday.updates?.find((u: any) => u.event === 'ORDER_COMPLETED');
        const collectedEvent = o.tracking_events.shipday.updates?.find((u: any) => u.event === 'ORDER_POD_UPLOAD');
        
        if (deliveredEvent) {
          const deliveredAt = new Date(deliveredEvent.timestamp);
          const creationToDelivery = (deliveredAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60); // hours
          
          let collectionToDelivery = 0;
          if (collectedEvent) {
            const collectedAt = new Date(collectedEvent.timestamp);
            collectionToDelivery = (deliveredAt.getTime() - collectedAt.getTime()) / (1000 * 60 * 60);
          }
          
          return {
            creationToDelivery,
            collectionToDelivery: collectedEvent ? collectionToDelivery : null,
          };
        }
        return null;
      })
      .filter(t => t !== null);

    const avgCreationToDelivery = deliveryTimes.length > 0
      ? deliveryTimes.reduce((sum, t) => sum + t.creationToDelivery, 0) / deliveryTimes.length
      : 0;

    const avgCollectionToDelivery = deliveryTimes.filter(t => t.collectionToDelivery !== null).length > 0
      ? deliveryTimes
          .filter(t => t.collectionToDelivery !== null)
          .reduce((sum, t) => sum + t.collectionToDelivery!, 0) / 
          deliveryTimes.filter(t => t.collectionToDelivery !== null).length
      : 0;

    // Calculate missing products summary
    const uniqueMissingProducts = [...new Set(allMissingProducts.map(mp => mp.product))];
    const getCustomersWithMissingProduct = (product: string) => {
      const customers = allMissingProducts
        .filter(mp => mp.product === product)
        .map(mp => mp.customerName);
      return [...new Set(customers)].join(', ');
    };
    
    // Calculate total bikes and skipped bikes
    const totalBikesInvoiced = successfulInvoices.reduce((sum, inv) => sum + (inv.bikeCount || 0), 0);
    const totalBikesSkipped = successfulInvoices.reduce((sum, inv) => sum + (inv.skippedBikes || 0), 0);

    // Send email report
    try {
      await supabase.functions.invoke("send-email", {
        body: {
          to: "info@cyclecourierco.com",
          subject: `Invoice Batch Report - ${format(startDate, "MMM d")} to ${format(endDate, "MMM d, yyyy")}`,
          html: `
            <h2>Invoice Batch Creation Report</h2>
            <p><strong>Date Range:</strong> ${format(startDate, "PPP")} to ${format(endDate, "PPP")}</p>
            
            <h3>Summary</h3>
            <ul>
              <li>Successful Invoices: ${successfulInvoices.length}</li>
              <li>Failed Invoices: ${failedInvoices.length}</li>
              <li>Skipped Customers: ${skippedCustomers.length}</li>
              <li>Total Customers Processed: ${eligibleCustomers.length}</li>
            </ul>

            <h3>Order & Bike Statistics</h3>
            <ul>
              <li>Total Orders Included in Invoices: ${allOrdersData.length}</li>
              <li>Total Bikes Invoiced: ${totalBikesInvoiced}</li>
              ${totalBikesSkipped > 0 ? `<li style="color: #dc2626;">Bikes Skipped (Missing Products): ${totalBikesSkipped}</li>` : ''}
              <li>Total Orders from Skipped Customers: ${skippedCustomers.reduce((sum, c) => sum + c.orderCount, 0)}</li>
              <li>Delivered Orders: ${deliveredOrders.length}</li>
              <li>Collected Orders: ${collectedOrders.length}</li>
              <li>Average Creation to Delivery: ${avgCreationToDelivery.toFixed(1)} hours</li>
              <li>Average Collection to Delivery: ${avgCollectionToDelivery.toFixed(1)} hours</li>
            </ul>

            ${uniqueMissingProducts.length > 0 ? `
              <h3 style="color: #dc2626;">⚠️ Missing QuickBooks Products (Bike Types)</h3>
              <p>The following bike types could not be matched to QuickBooks products and were excluded from invoices:</p>
              <table border="1" cellpadding="8" cellspacing="0" style="background-color: #fee2e2;">
                <tr>
                  <th>Bike Type</th>
                  <th>Affected Customers</th>
                </tr>
                ${uniqueMissingProducts.map(product => `
                  <tr>
                    <td>${product}</td>
                    <td>${getCustomersWithMissingProduct(product)}</td>
                  </tr>
                `).join('')}
              </table>
              <p><strong>Action Required:</strong> Create these products in QuickBooks with the naming format:<br>
              "Collection and Delivery within England and Wales - [Bike Type]"</p>
            ` : '<p style="color: #16a34a;">✓ All bike types matched to QuickBooks products</p>'}

            <h3>Successful Invoices</h3>
            ${successfulInvoices.length > 0 ? `
              <table border="1" cellpadding="8" cellspacing="0">
                <tr>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Orders</th>
                  <th>Bikes</th>
                  <th>Invoice #</th>
                </tr>
                ${successfulInvoices.map(inv => `
                  <tr>
                    <td>${inv.customerName}</td>
                    <td>${inv.customerEmail}</td>
                    <td>${inv.orderCount}</td>
                    <td>${inv.bikeCount}${inv.skippedBikes > 0 ? ` <span style="color: #dc2626;">(${inv.skippedBikes} skipped)</span>` : ''}</td>
                    <td>${inv.invoiceNumber || 'N/A'}</td>
                  </tr>
                `).join('')}
              </table>
            ` : '<p>No successful invoices</p>'}

            <h3>Failed Invoices</h3>
            ${failedInvoices.length > 0 ? `
              <table border="1" cellpadding="8" cellspacing="0">
                <tr>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Error</th>
                </tr>
                ${failedInvoices.map(inv => `
                  <tr>
                    <td>${inv.customerName}</td>
                    <td>${inv.customerEmail}</td>
                    <td>${inv.error}</td>
                  </tr>
                `).join('')}
              </table>
            ` : '<p>No failed invoices</p>'}

            <h3>Skipped Customers</h3>
            ${skippedCustomers.length > 0 ? `
              <table border="1" cellpadding="8" cellspacing="0" style="background-color: #fff3cd;">
                <tr>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Orders in Range</th>
                  <th>Reason</th>
                </tr>
                ${skippedCustomers.map(cust => `
                  <tr>
                    <td>${cust.customerName}</td>
                    <td>${cust.customerEmail}</td>
                    <td>${cust.orderCount}</td>
                    <td>${cust.reason}</td>
                  </tr>
                `).join('')}
              </table>
              <p><strong>Note:</strong> These customers were excluded from invoice creation. To include them, add an accounts email address in User Management.</p>
            ` : '<p>No customers were skipped</p>'}
          `,
        },
      });

      console.log("Report email sent successfully");
    } catch (emailError) {
      console.error("Failed to send report email:", emailError);
    }

    setIsCreatingAllInvoices(false);
    setBatchProgress({ current: 0, total: 0 });
    refetchHistory();

    toast({
      title: "Batch Complete",
      description: `Created ${successfulInvoices.length} invoices. ${failedInvoices.length} failed. Report sent to info@cyclecourierco.com`,
    });
  };

  return (
    <Layout>
      <div className="container px-4 py-6 md:px-6 mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Create Invoice</h1>
          </div>
          
          {!quickBooksConnected && (
            <Button 
              onClick={handleConnectQuickBooks}
              disabled={isConnectingQuickBooks}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {isConnectingQuickBooks ? 'Connecting...' : 'Connect to QuickBooks'}
            </Button>
          )}
          
          {quickBooksConnected && (
            <div className="flex items-center gap-2 text-green-600">
              <div className="h-2 w-2 bg-green-600 rounded-full"></div>
              QuickBooks Connected
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Invoice Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Customer Selection */}
            <div className="space-y-2">
              <Label htmlFor="customer">Select Customer</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a customer..." />
                </SelectTrigger>
                <SelectContent>
                  {customersLoading ? (
                    <SelectItem value="loading" disabled>Loading customers...</SelectItem>
                  ) : (
                    customers?.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} ({customer.email})
                        {customer.accounts_email && " ✓"}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedCustomerData && !selectedCustomerData.accounts_email && (
                <p className="text-sm text-destructive">
                  This customer needs an accounts email address for invoicing.
                </p>
              )}
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders Preview */}
        {ordersError && (
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">Error Loading Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-destructive">{ordersError.message}</p>
            </CardContent>
          </Card>
        )}

        {orders && orders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Orders to Invoice ({orders.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {orders.map((order) => (
                  <div key={order.id} className="flex justify-between items-center p-2 border rounded">
                    <div>
                      <p className="font-medium">
                        {order.tracking_number} - {order.bike_brand} {order.bike_model}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {order.sender?.name} → {order.receiver?.name}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(order.created_at), "MMM d, yyyy")}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create Invoice Button */}
        <div className="space-y-4">
          {selectedCustomer && startDate && endDate && (
            <div className="text-sm text-muted-foreground">
              {!selectedCustomerData?.accounts_email && (
                <p className="text-destructive">❌ Customer needs an accounts email address</p>
              )}
              {ordersLoading && <p>🔄 Loading orders...</p>}
              {!ordersLoading && orders && orders.length === 0 && (
                <p className="text-yellow-600">⚠️ No orders found in selected date range</p>
              )}
              {!ordersLoading && orders && orders.length > 0 && selectedCustomerData?.accounts_email && (
                <p className="text-green-600">✅ Ready to create invoice with {orders.length} orders</p>
              )}
            </div>
          )}
          
          <div className="flex justify-end gap-3">
            <Button
              onClick={handleCreateAllInvoices}
              disabled={
                !startDate ||
                !endDate ||
                isCreatingInvoice ||
                isCreatingAllInvoices ||
                !quickBooksConnected
              }
              size="lg"
              variant="secondary"
              className="min-w-[200px]"
            >
              <FileText className="mr-2 h-4 w-4" />
              {isCreatingAllInvoices 
                ? `Creating... ${batchProgress.current}/${batchProgress.total}` 
                : "Create All Invoices"}
            </Button>

            <Button
              onClick={handleCreateInvoice}
              disabled={
                !selectedCustomer ||
                !startDate ||
                !endDate ||
                !orders ||
                orders.length === 0 ||
                !selectedCustomerData?.accounts_email ||
                isCreatingInvoice ||
                isCreatingAllInvoices ||
                !quickBooksConnected
              }
              size="lg"
              className="min-w-[200px]"
            >
              <Send className="mr-2 h-4 w-4" />
              {isCreatingInvoice ? "Creating Invoice..." : "Create QuickBooks Invoice"}
            </Button>
          </div>
        </div>

        {/* Invoice History Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoice History
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* History Filters */}
            <div className="border-b pb-4">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="h-4 w-4" />
                <Label className="text-sm font-medium">Filter History</Label>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Select value={historyCustomerFilter} onValueChange={setHistoryCustomerFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All customers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All customers</SelectItem>
                      {customers?.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>From Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {historyStartDate ? format(historyStartDate, "PPP") : "Any date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={historyStartDate}
                        onSelect={setHistoryStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>To Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {historyEndDate ? format(historyEndDate, "PPP") : "Any date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={historyEndDate}
                        onSelect={setHistoryEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {(historyCustomerFilter !== "all" || historyStartDate || historyEndDate) && (
                <div className="mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setHistoryCustomerFilter("all");
                      setHistoryStartDate(undefined);
                      setHistoryEndDate(undefined);
                    }}
                  >
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>

            {/* History List */}
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : invoiceHistory && invoiceHistory.length > 0 ? (
              <div className="space-y-4">
                {invoiceHistory.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{invoice.customer_name}</h4>
                        {invoice.quickbooks_invoice_number && (
                          <span className="text-sm text-muted-foreground">
                            #{invoice.quickbooks_invoice_number}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {invoice.customer_email} • {invoice.order_count} orders • £{invoice.total_amount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(invoice.start_date), "MMM d")} - {format(new Date(invoice.end_date), "MMM d, yyyy")} • 
                        Created {format(new Date(invoice.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        invoice.status === 'created' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                      }`}>
                        {invoice.status}
                      </span>
                      
                      {invoice.quickbooks_invoice_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(invoice.quickbooks_invoice_url, '_blank')}
                          className="flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          View in QuickBooks
                        </Button>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteInvoice(invoice.id)}
                        className="flex items-center gap-1 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No invoices found</p>
                <p className="text-sm">
                  {(historyCustomerFilter !== "all" || historyStartDate || historyEndDate) 
                    ? "Try adjusting your filters or create your first invoice above"
                    : "Create your first invoice above to see it here"
                  }
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}