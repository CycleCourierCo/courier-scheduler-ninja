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
import { CalendarIcon, FileText, Send, ExternalLink, Eye, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";

type Customer = {
  id: string;
  name: string;
  email: string;
  accounts_email?: string;
};

type InvoiceItem = {
  id: string;
  created_at: string;
  tracking_number: string;
  bike_brand: string;
  bike_model: string;
  sender: any;
  receiver: any;
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
        .neq("role", "admin")
        .order("name");
      
      if (error) throw error;
      return data as Customer[];
    },
  });

  // Check QuickBooks connection status
  const { data: quickBooksToken } = useQuery({
    queryKey: ['quickbooks-token'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quickbooks_tokens')
        .select('expires_at')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
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
      if (historyStartDate) {
        query = query.gte('created_at', historyStartDate.toISOString());
      }
      if (historyEndDate) {
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
    if (quickBooksToken && new Date(quickBooksToken.expires_at) > new Date()) {
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
          sender,
          receiver
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

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-8">
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
          
          <div className="flex justify-end">
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