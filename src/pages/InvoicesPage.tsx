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
import { CalendarIcon, FileText, Send, ExternalLink, Eye, Filter, Trash2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";
import Layout from "@/components/Layout";
import UnlinkedInvoicesPanel from "@/components/invoices/UnlinkedInvoicesPanel";
import CancelledInvoicedPanel from "@/components/invoices/CancelledInvoicedPanel";

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
  is_box_my_bike: boolean | null;
  is_northern_ireland?: boolean | null;
  guaranteed_delivery?: boolean | null;
  guaranteed_delivery_payer?: string | null;
  guaranteed_delivery_amount?: number | null;
  guaranteed_delivery_note?: string | null;
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
  quickbooks_invoice_public_url?: string | null;
  status: string;
  created_at: string;
};

type InvoiceSyncRun = {
  id: string;
  completed_at: string | null;
  status: string;
  invoices_scanned: number;
  linked_count: number;
  already_linked_count: number;
  unmatched_count: number;
  ambiguous_count: number;
};

type UnlinkedInvoiceSummary = {
  unlinked_count: number;
  earliest_date: string | null;
  latest_date: string | null;
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
  const [isSyncingInvoices, setIsSyncingInvoices] = useState(false);
  
  // Invoice history filters
  const [historyCustomerFilter, setHistoryCustomerFilter] = useState<string>("all");
  const [historyStartDate, setHistoryStartDate] = useState<Date>();
  const [historyEndDate, setHistoryEndDate] = useState<Date>();
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 25;
  useEffect(() => { setHistoryPage(1); }, [historyCustomerFilter, historyStartDate, historyEndDate]);
  

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

  const { data: latestSync, refetch: refetchLatestSync } = useQuery({
    queryKey: ["latest-order-invoice-sync"],
    queryFn: async () => {
      const { data, error } = await supabase.from("order_invoice_sync_runs")
        .select("id, completed_at, status, invoices_scanned, linked_count, already_linked_count, unmatched_count, ambiguous_count")
        .order("started_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data as InvoiceSyncRun | null;
    },
  });

  const { data: unlinkedSummary, refetch: refetchUnlinkedSummary } = useQuery({
    queryKey: ["unlinked-invoice-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("unlinked_invoice_summary");
      if (error) throw error;
      const row = (data && data[0]) || null;
      return row as UnlinkedInvoiceSummary | null;
    },
  });

  const { data: invoiceCutoff } = useQuery({
    queryKey: ["invoice-check-cutoff"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("invoice_check_cutoff");
      if (error) throw error;
      return (data as string | null) || null;
    },
  });

  const handleSyncOrderInvoices = async () => {
    setIsSyncingInvoices(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-order-invoices", { body: {} });
      if (error) throw error;
      const stillUnlinked = typeof data?.unlinkedCount === "number"
        ? ` ${data.unlinkedCount} orders still unlinked.`
        : "";
      notify.success("Invoice links synced", {
        description: `${data.linkedCount} linked, ${data.alreadyLinkedCount} already linked, ${data.unmatchedCount} unmatched, ${data.ambiguousCount} ambiguous.${stillUnlinked}`,
      });
      refetchLatestSync();
      refetchUnlinkedSummary();
    } catch (error: any) {
      console.error("Invoice link sync failed:", error);
      notify.error("Invoice sync failed", { description: error?.message || "Could not sync QuickBooks invoices" });
    } finally {
      setIsSyncingInvoices(false);
    }
  };

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
  const { data: historyResult, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['invoice-history', historyCustomerFilter, historyStartDate, historyEndDate, historyPage],
    queryFn: async () => {
      let query = supabase
        .from('invoice_history')
        .select('*', { count: 'exact' });

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

      query = query.order('created_at', { ascending: false }).range((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data || []) as InvoiceHistory[], count: count || 0 };
    },
  });

  const invoiceHistory = historyResult?.rows;
  const historyPageCount = Math.max(1, Math.ceil((historyResult?.count || 0) / HISTORY_PAGE_SIZE));

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
          needs_inspection,
          is_box_my_bike,
          is_northern_ireland,
          guaranteed_delivery,
          guaranteed_delivery_payer,
          guaranteed_delivery_amount,
          guaranteed_delivery_note
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

  const { data: storagePreview, isLoading: storageLoading, error: storageError, refetch: refetchStorage } = useQuery({
    queryKey: ['storage-for-invoice', selectedCustomer, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('create-quickbooks-invoice', {
        body: { customerId: selectedCustomer, startDate: startDate?.toISOString(), endDate: endDate?.toISOString(), previewStorage: true },
      });
      if (error) throw error;
      return data as { storageCount: number; storageTotal: number; periods: { bike: string; start: string; end: string }[] };
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
      notify.error("Connection Failed", { description: error.message || "Failed to connect to QuickBooks" });
    } finally {
      setIsConnectingQuickBooks(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    notify.confirm({
      title: "Delete this invoice?",
      description: "This action cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('invoice_history')
            .delete()
            .eq('id', invoiceId);
          if (error) throw error;
          notify.success("Invoice Deleted", { description: "The invoice has been deleted successfully." });
          refetchHistory();
        } catch (error: any) {
          console.error('Error deleting invoice:', error);
          notify.error("Delete Failed", { description: error.message || "Failed to delete invoice" });
        }
      },
    });
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
    if (!selectedCustomerData || !orders || storageLoading || storageError || (orders.length === 0 && !storagePreview?.storageCount) || !startDate || !endDate) {
      notify.error("Missing Information", { description: "Please select a customer, date range, and ensure there are orders or storage charges to invoice." });
      return;
    }

    if (!selectedCustomerData.accounts_email) {
      notify.error("Missing Accounts Email", { description: "Customer must have an accounts email address set up for invoicing." });
      return;
    }

    if (!quickBooksConnected) {
      notify.error("QuickBooks Not Connected", { description: "Please connect to QuickBooks before creating invoices." });
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
          orders,
        },
      });

      if (error) throw error;

      notify.success("Invoice Created", { description: `QuickBooks invoice has been sent to ${selectedCustomerData.accounts_email}` });

      // Refetch invoice history to show the new invoice
      refetchHistory();
      refetchStorage();

    } catch (error: any) {
      console.error("Error creating invoice:", error);
      notify.error("Error Creating Invoice", { description: error.message || "Failed to create QuickBooks invoice" });
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  const handleCreateAllInvoices = async () => {
    if (!startDate || !endDate) {
      notify.error("Missing Date Range", { description: "Please select start and end dates." });
      return;
    }

    if (!quickBooksConnected) {
      notify.error("QuickBooks Not Connected", { description: "Please connect to QuickBooks before creating invoices." });
      return;
    }

    const eligibleCustomers = customers?.filter(c => c.accounts_email) || [];
    setIsCreatingAllInvoices(true);
    setBatchProgress({ current: 0, total: 0 });
    try {
      // The whole batch runs on the server, so closing this page can't stop it halfway.
      const { data, error } = await supabase.functions.invoke("weekly-invoice-batch", {
        body: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
      });
      if (error || !data?.logId) throw error || new Error("Could not start the invoice run");
      notify.success("Invoice run started", { description: "It carries on even if you close this page. A report goes to info@cyclecourierco.com when it finishes." });
      const logId = data.logId as string;
      const started = Date.now();
      while (Date.now() - started < 30 * 60_000) {
        await new Promise((r) => setTimeout(r, 4000));
        const { data: run } = await supabase
          .from("weekly_invoice_batch_logs")
          .select("status, eligible_count, successful_count, failed_count, skipped_count, error_message")
          .eq("id", logId)
          .maybeSingle();
        if (!run) continue;
        const done = (run.successful_count || 0) + (run.failed_count || 0) + (run.skipped_count || 0);
        setBatchProgress({ current: done, total: run.eligible_count || 0 });
        if (run.status !== "running") {
          if (run.status === "failed") notify.error("Invoice run failed", { description: run.error_message || "See the report email" });
          else notify.success("Batch Complete", { description: `Created ${run.successful_count} invoices. ${run.failed_count} failed. ${run.skipped_count} skipped. Report sent to info@cyclecourierco.com` });
          break;
        }
      }
    } catch (err: any) {
      notify.error("Couldn't start invoice run", { description: err?.message || "Please try again" });
    } finally {
      setIsCreatingAllInvoices(false);
      setBatchProgress({ current: 0, total: 0 });
      refetchHistory();
    }
  };

  return (
    <Layout>
      <div className="container px-4 py-6 md:px-6 mx-auto space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-8 w-8 text-primary shrink-0" />
            <h1 className="text-2xl sm:text-3xl font-bold break-words">Create Invoice</h1>
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
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="flex items-center gap-2 text-green-600">
                <div className="h-2 w-2 bg-green-600 rounded-full"></div>
                QuickBooks Connected
              </div>
              <Button variant="outline" onClick={handleSyncOrderInvoices} disabled={isSyncingInvoices}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isSyncingInvoices ? "animate-spin" : ""}`} />
                {isSyncingInvoices ? "Syncing…" : "Sync order invoice links"}
              </Button>
            </div>
          )}
        </div>

        {latestSync && (
          <div className="text-sm text-muted-foreground">
            Last invoice-link sync: {latestSync.status}
            {latestSync.completed_at ? ` on ${format(new Date(latestSync.completed_at), "d MMM yyyy 'at' HH:mm")}` : ""}
            {latestSync.status === "completed" ? ` — ${latestSync.linked_count} linked, ${latestSync.already_linked_count} already linked, ${latestSync.unmatched_count} unmatched, ${latestSync.ambiguous_count} ambiguous.` : ""}
          </div>
        )}

        {unlinkedSummary && unlinkedSummary.unlinked_count > 0 && (
          <div className="rounded-md border border-status-waiting/40 bg-status-waiting/10 px-3 py-2 text-sm">
            <span className="font-medium">
              {unlinkedSummary.unlinked_count.toLocaleString()} delivered {unlinkedSummary.unlinked_count === 1 ? "order has" : "orders have"} no linked invoice
            </span>
            {unlinkedSummary.earliest_date && unlinkedSummary.latest_date && (
              <span className="text-muted-foreground">
                {" "}— spanning {format(new Date(`${unlinkedSummary.earliest_date}T12:00:00`), "d MMM yyyy")}
                {" "}to {format(new Date(`${unlinkedSummary.latest_date}T12:00:00`), "d MMM yyyy")}
              </span>
            )}
            . No QuickBooks invoice mentions these jobs by tracking number, so syncing again won't link them. Open the list below to link them by hand or mark them as not to be invoiced.
          </div>
        )}

        {invoiceCutoff && (
          <p className="text-sm text-muted-foreground">
            Jobs from {format(new Date(invoiceCutoff), "d MMM yyyy")} onwards are waiting for the next weekly invoice run, so they aren't counted as missing yet.
          </p>
        )}

        <UnlinkedInvoicesPanel onChanged={() => refetchUnlinkedSummary()} />

        <CancelledInvoicedPanel />

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
                  <div key={order.id} className="flex flex-wrap justify-between items-start gap-2 p-2 border rounded">
                    <div className="min-w-0">
                      <p className="font-medium break-words">
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

        {storagePreview && storagePreview.storageCount > 0 && (
          <Card>
            <CardHeader><CardTitle>Warehouse Storage ({storagePreview.storageCount} × £40 including VAT)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {storagePreview.periods.map((period, index) => (
                <div key={`${period.bike}-${period.start}-${index}`} className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm">
                  <span>{period.bike} · {period.start} to {period.end}</span><span>£40.00</span>
                </div>
              ))}
              <p className="font-medium">Total storage: £{storagePreview.storageTotal.toFixed(2)}</p>
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
              {storageLoading && <p>Checking storage charges...</p>}
              {storageError && <p className="text-destructive">Unable to check storage charges. Please retry before invoicing.</p>}
              {!ordersLoading && !storageLoading && orders && orders.length === 0 && !storagePreview?.storageCount && !storageError && (
                <p className="text-muted-foreground">No orders or storage charges due</p>
              )}
              {!ordersLoading && !storageLoading && orders && (orders.length > 0 || storagePreview?.storageCount) && selectedCustomerData?.accounts_email && (
                <p className="text-foreground">Ready: {orders.length} orders, {storagePreview?.storageCount || 0} storage periods</p>
              )}
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
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
              className="w-full sm:w-auto sm:min-w-[200px]"
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
                (orders.length === 0 && !storagePreview?.storageCount) ||
                storageLoading || !!storageError ||
                !selectedCustomerData?.accounts_email ||
                isCreatingInvoice ||
                isCreatingAllInvoices ||
                !quickBooksConnected
              }
              size="lg"
              className="w-full sm:w-auto sm:min-w-[200px]"
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
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h4 className="font-medium break-words">{invoice.customer_name}</h4>
                        {invoice.quickbooks_invoice_number && (
                          <span className="text-sm text-muted-foreground">
                            #{invoice.quickbooks_invoice_number}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground break-all">
                        {invoice.customer_email} • {invoice.order_count} orders • £{invoice.total_amount}
                      </p>
                      <p className="text-xs text-muted-foreground break-words">
                        {format(new Date(invoice.start_date), "MMM d")} - {format(new Date(invoice.end_date), "MMM d, yyyy")} • 
                        Created {format(new Date(invoice.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">

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

                      {invoice.quickbooks_invoice_public_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(invoice.quickbooks_invoice_public_url!, '_blank')}
                          className="flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          Customer link
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
                <div className="flex items-center justify-between pt-2 text-sm">
                  <span className="text-muted-foreground">Page {historyPage} of {historyPageCount} · {historyResult?.count || 0} invoices</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={historyPage <= 1} onClick={() => setHistoryPage(historyPage - 1)}>Previous</Button>
                    <Button size="sm" variant="outline" disabled={historyPage >= historyPageCount} onClick={() => setHistoryPage(historyPage + 1)}>Next</Button>
                  </div>
                </div>
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