import { useState, useRef, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Filter, SortDesc, SortAsc, Check, Plus, Calendar as CalendarIcon, Users, Bike, CalendarX, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const statusOptions = [
  { value: "created", label: "Created" },
  { value: "sender_availability_pending", label: "Sender Availability Pending" },
  { value: "sender_availability_confirmed", label: "Sender Availability Confirmed" },
  { value: "receiver_availability_pending", label: "Receiver Availability Pending" },
  { value: "receiver_availability_confirmed", label: "Receiver Availability Confirmed" },
  { value: "scheduled_dates_pending", label: "Scheduled Dates Pending" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "scheduled", label: "Scheduled" },
  { value: "collection_scheduled", label: "Collection Scheduled" },
  { value: "driver_to_collection", label: "Driver to Collection" },
  { value: "collected", label: "Collected" },
  { value: "delivery_scheduled", label: "Delivery Scheduled" },
  { value: "driver_to_delivery", label: "Driver to Delivery" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const bikeTypeOptions = [
  { value: "Non-Electric - Mountain Bike", label: "Non-Electric - Mountain Bike" },
  { value: "Non-Electric - Road Bike", label: "Non-Electric - Road Bike" },
  { value: "Non-Electric - Hybrid", label: "Non-Electric - Hybrid" },
  { value: "Electric Bike - Under 25kg", label: "Electric Bike - Under 25kg" },
  { value: "Electric Bike - 25-50kg", label: "Electric Bike - 25-50kg" },
  { value: "Cargo Bike", label: "Cargo Bike" },
  { value: "Longtail Cargo Bike", label: "Longtail Cargo Bike" },
  { value: "Stationary Bike", label: "Stationary Bike" },
  { value: "Kids Bikes", label: "Kids Bikes" },
  { value: "BMX Bikes", label: "BMX Bikes" },
  { value: "Boxed Kids Bikes", label: "Boxed Kids Bikes" },
  { value: "Folding Bikes", label: "Folding Bikes" },
  { value: "Tandem", label: "Tandem" },
  { value: "Travel Bike Box", label: "Travel Bike Box" },
  { value: "Wheelset/Frameset", label: "Wheelset/Frameset" },
  { value: "Bike Rack", label: "Bike Rack" },
  { value: "Turbo Trainer", label: "Turbo Trainer" },
  { value: "Electric Bikes", label: "Electric Bikes (Legacy)" },
  { value: "Non-Electric Bikes", label: "Non-Electric Bikes (Legacy)" },
];

const sortOptions = [
  { value: "created_desc", label: "Newest First" },
  { value: "created_asc", label: "Oldest First" },
  { value: "sender_name", label: "Sender Name (A-Z)" },
  { value: "receiver_name", label: "Receiver Name (A-Z)" },
];

interface OrderFiltersProps {
  onFilterChange: (filters: {
    status: string[];
    search: string;
    sortBy: string;
    dateFrom: Date | undefined;
    dateTo: Date | undefined;
    customerId?: string;
    bikeType?: string[];
    missingDates?: 'sender' | 'receiver' | 'either';
  }) => void;
  initialFilters?: {
    status: string[];
    search: string;
    sortBy: string;
    dateFrom: Date | undefined;
    dateTo: Date | undefined;
    customerId?: string;
    bikeType?: string[];
    missingDates?: 'sender' | 'receiver' | 'either';
  };
  userRole: string | null;
}

const OrderFilters: React.FC<OrderFiltersProps> = ({
  onFilterChange,
  initialFilters = { status: [], search: "", sortBy: "created_desc", dateFrom: undefined, dateTo: undefined, customerId: undefined, bikeType: [], missingDates: undefined },
  userRole,
}) => {
  const [status, setStatus] = useState<string[]>(initialFilters.status);
  const [search, setSearch] = useState<string>(initialFilters.search);
  const [sortBy, setSortBy] = useState<string>(initialFilters.sortBy);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(initialFilters.dateFrom);
  const [dateTo, setDateTo] = useState<Date | undefined>(initialFilters.dateTo);
  const [customerId, setCustomerId] = useState<string | undefined>(initialFilters.customerId);
  const [bikeType, setBikeType] = useState<string[]>(initialFilters.bikeType || []);
  const [missingDates, setMissingDates] = useState<'sender' | 'receiver' | 'either' | undefined>(initialFilters.missingDates);
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [bikeTypePopoverOpen, setBikeTypePopoverOpen] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const { data: customers } = useQuery({
    queryKey: ["b2b-customers"],
    queryFn: async () => {
      if (userRole !== "admin") return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email")
        .eq("role", "b2b_customer")
        .eq("account_status", "approved")
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; email: string }[];
    },
    enabled: userRole === "admin",
  });

  const emit = (overrides: Partial<{
    status: string[]; search: string; sortBy: string; dateFrom: Date | undefined; dateTo: Date | undefined; customerId?: string; bikeType: string[]; missingDates?: 'sender' | 'receiver' | 'either';
  }>) => {
    onFilterChange({
      status, search, sortBy, dateFrom, dateTo, customerId, bikeType, missingDates,
      ...overrides,
    });
  };

  const handleStatusToggle = (value: string) => {
    const newStatus = status.includes(value) ? status.filter(s => s !== value) : [...status, value];
    setStatus(newStatus);
    emit({ status: newStatus });
  };

  const handleBikeTypeToggle = (value: string) => {
    const newBikeType = bikeType.includes(value) ? bikeType.filter(t => t !== value) : [...bikeType, value];
    setBikeType(newBikeType);
    emit({ bikeType: newBikeType });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearch = e.target.value;
    setSearch(newSearch);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => emit({ search: newSearch }), 300);
  };

  const clearSearch = () => {
    setSearch("");
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    emit({ search: "" });
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    emit({ sortBy: value });
  };

  const handleDateFromChange = (date: Date | undefined) => {
    setDateFrom(date);
    emit({ dateFrom: date });
  };

  const handleDateToChange = (date: Date | undefined) => {
    setDateTo(date);
    emit({ dateTo: date });
  };

  const handleCustomerChange = (value: string) => {
    const newCustomerId = value === "all" ? undefined : value;
    setCustomerId(newCustomerId);
    emit({ customerId: newCustomerId });
  };

  const handleMissingDatesChange = (value: string) => {
    const newMissing = value === "any" ? undefined : (value as 'sender' | 'receiver' | 'either');
    setMissingDates(newMissing);
    emit({ missingDates: newMissing });
  };

  const handleClearFilters = () => {
    setStatus([]); setSearch(""); setSortBy("created_desc");
    setDateFrom(undefined); setDateTo(undefined);
    setCustomerId(undefined); setBikeType([]); setMissingDates(undefined);
    onFilterChange({ status: [], search: "", sortBy: "created_desc", dateFrom: undefined, dateTo: undefined, customerId: undefined, bikeType: [], missingDates: undefined });
  };

  const dateLabel = () => {
    if (!dateFrom && !dateTo) return "Date Range";
    if (dateFrom && dateTo) return `${format(dateFrom, "MMM d")} – ${format(dateTo, "MMM d")}`;
    if (dateFrom) return `From ${format(dateFrom, "MMM d")}`;
    if (dateTo) return `Until ${format(dateTo, "MMM d")}`;
    return "Date Range";
  };

  const missingLabel =
    missingDates === "sender" ? "Sender dates missing"
    : missingDates === "receiver" ? "Receiver dates missing"
    : missingDates === "either" ? "Either missing"
    : null;

  const customerLabel = customerId ? (customers?.find(c => c.id === customerId)?.name ?? "Customer") : null;

  const activeCount =
    status.length + bikeType.length +
    (dateFrom || dateTo ? 1 : 0) +
    (customerId ? 1 : 0) +
    (missingDates ? 1 : 0) +
    (sortBy !== "created_desc" ? 1 : 0);

  const hasActiveFilters = activeCount > 0 || search.length > 0;

  const popoverContentBase = "p-0 max-w-[calc(100vw-2rem)]";

  return (
    <div className="space-y-3">
      {/* Search bar row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, email, postcode, tracking, bike…"
            value={search}
            onChange={handleSearchChange}
            className="pl-12 pr-10 h-12 text-base"
          />
          {search && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground rounded-sm p-1"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button asChild size="lg" className="h-12 sm:w-auto w-full">
          <Link to="/create-order">
            <Plus className="mr-2 h-4 w-4" />
            New Order
          </Link>
        </Button>
      </div>

      {/* Filter grid */}
      <div className={cn(
        "grid gap-2 grid-cols-2 md:grid-cols-3",
        userRole === "admin" ? "lg:grid-cols-6" : "lg:grid-cols-5",
      )}>
        {/* Status */}
        <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between h-10">
              <span className="flex items-center min-w-0">
                <Filter className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">Status</span>
              </span>
              {status.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">{status.length}</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" collisionPadding={16} className={cn(popoverContentBase, "w-[min(20rem,calc(100vw-2rem))]")}>
            <div className="p-3 max-h-[60vh] overflow-y-auto">
              <div className="text-sm font-medium mb-2">Filter by Status</div>
              <div className="space-y-1">
                {statusOptions.map(option => (
                  <div
                    key={option.value}
                    className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded-sm p-2"
                    onClick={() => handleStatusToggle(option.value)}
                  >
                    <div className="w-4 h-4 border border-muted-foreground rounded flex items-center justify-center shrink-0">
                      {status.includes(option.value) && <Check className="h-3 w-3" />}
                    </div>
                    <span className="text-sm">{option.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Bike Type */}
        <Popover open={bikeTypePopoverOpen} onOpenChange={setBikeTypePopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between h-10">
              <span className="flex items-center min-w-0">
                <Bike className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">Bike Type</span>
              </span>
              {bikeType.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">{bikeType.length}</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" collisionPadding={16} className={cn(popoverContentBase, "w-[min(20rem,calc(100vw-2rem))]")}>
            <div className="p-3 max-h-[60vh] overflow-y-auto">
              <div className="text-sm font-medium mb-2">Filter by Bike Type</div>
              <div className="space-y-1">
                {bikeTypeOptions.map(option => (
                  <div
                    key={option.value}
                    className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded-sm p-2"
                    onClick={() => handleBikeTypeToggle(option.value)}
                  >
                    <div className="w-4 h-4 border border-muted-foreground rounded flex items-center justify-center shrink-0">
                      {bikeType.includes(option.value) && <Check className="h-3 w-3" />}
                    </div>
                    <span className="text-sm">{option.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Date Range */}
        <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between h-10">
              <span className="flex items-center min-w-0">
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">{dateLabel()}</span>
              </span>
              {(dateFrom || dateTo) && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">1</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" collisionPadding={16} className={cn(popoverContentBase, "w-[min(20rem,calc(100vw-2rem))]")}>
            <div className="p-3 space-y-3">
              <div className="text-sm font-medium">Filter by Date Range</div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">From</label>
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={handleDateFromChange}
                    className={cn("p-2 pointer-events-auto rounded-md border mt-1")}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">To</label>
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={handleDateToChange}
                    className={cn("p-2 pointer-events-auto rounded-md border mt-1")}
                  />
                </div>
                {(dateFrom || dateTo) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setDateFrom(undefined);
                      setDateTo(undefined);
                      emit({ dateFrom: undefined, dateTo: undefined });
                    }}
                  >
                    Clear Date Filter
                  </Button>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Sort */}
        <Select value={sortBy} onValueChange={handleSortChange}>
          <SelectTrigger className="h-10">
            {sortBy.includes("desc") ? <SortDesc className="mr-2 h-4 w-4" /> : <SortAsc className="mr-2 h-4 w-4" />}
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Missing Availability */}
        <Select value={missingDates ?? "any"} onValueChange={handleMissingDatesChange}>
          <SelectTrigger className="h-10">
            <CalendarX className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Availability" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">All Orders</SelectItem>
            <SelectItem value="sender">Sender dates missing</SelectItem>
            <SelectItem value="receiver">Receiver dates missing</SelectItem>
            <SelectItem value="either">Either missing</SelectItem>
          </SelectContent>
        </Select>

        {/* Customer (admin only) */}
        {userRole === "admin" && (
          <Select value={customerId || "all"} onValueChange={handleCustomerChange}>
            <SelectTrigger className="h-10">
              <Users className="mr-2 h-4 w-4" />
              <SelectValue placeholder="All Customers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              {customers?.map(customer => (
                <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Active filter chips + clear */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {status.map(s => {
            const opt = statusOptions.find(o => o.value === s);
            return (
              <Badge key={`s-${s}`} variant="secondary" className="cursor-pointer gap-1" onClick={() => handleStatusToggle(s)}>
                {opt?.label ?? s}
                <X className="h-3 w-3" />
              </Badge>
            );
          })}
          {bikeType.map(t => {
            const opt = bikeTypeOptions.find(o => o.value === t);
            return (
              <Badge key={`b-${t}`} variant="secondary" className="cursor-pointer gap-1" onClick={() => handleBikeTypeToggle(t)}>
                {opt?.label ?? t}
                <X className="h-3 w-3" />
              </Badge>
            );
          })}
          {(dateFrom || dateTo) && (
            <Badge
              variant="secondary"
              className="cursor-pointer gap-1"
              onClick={() => {
                setDateFrom(undefined);
                setDateTo(undefined);
                emit({ dateFrom: undefined, dateTo: undefined });
              }}
            >
              {dateLabel()}
              <X className="h-3 w-3" />
            </Badge>
          )}
          {customerLabel && (
            <Badge variant="secondary" className="cursor-pointer gap-1" onClick={() => handleCustomerChange("all")}>
              {customerLabel}
              <X className="h-3 w-3" />
            </Badge>
          )}
          {missingLabel && (
            <Badge variant="secondary" className="cursor-pointer gap-1" onClick={() => handleMissingDatesChange("any")}>
              {missingLabel}
              <X className="h-3 w-3" />
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={handleClearFilters} className="ml-auto">
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
};

export default memo(OrderFilters);
