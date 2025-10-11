
import { useState, useRef } from "react";
import { Search, Filter, SortDesc, SortAsc, Check, Plus, Calendar as CalendarIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
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
  { value: "cancelled", label: "Cancelled" }
];

const sortOptions = [
  { value: "created_desc", label: "Newest First" },
  { value: "created_asc", label: "Oldest First" },
  { value: "sender_name", label: "Sender Name (A-Z)" },
  { value: "receiver_name", label: "Receiver Name (A-Z)" }
];

interface OrderFiltersProps {
  onFilterChange: (filters: {
    status: string[];
    search: string;
    sortBy: string;
    dateFrom: Date | undefined;
    dateTo: Date | undefined;
  }) => void;
  initialFilters?: {
    status: string[];
    search: string;
    sortBy: string;
    dateFrom: Date | undefined;
    dateTo: Date | undefined;
  };
}

const OrderFilters: React.FC<OrderFiltersProps> = ({ 
  onFilterChange, 
  initialFilters = { status: [], search: "", sortBy: "created_desc", dateFrom: undefined, dateTo: undefined }
}) => {
  const [status, setStatus] = useState<string[]>(initialFilters.status);
  const [search, setSearch] = useState<string>(initialFilters.search);
  const [sortBy, setSortBy] = useState<string>(initialFilters.sortBy);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(initialFilters.dateFrom);
  const [dateTo, setDateTo] = useState<Date | undefined>(initialFilters.dateTo);
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const handleStatusToggle = (value: string) => {
    const newStatus = status.includes(value)
      ? status.filter(s => s !== value)
      : [...status, value];
    setStatus(newStatus);
    onFilterChange({ status: newStatus, search, sortBy, dateFrom, dateTo });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearch = e.target.value;
    setSearch(newSearch);
    
    // Debounce the search filter change
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      onFilterChange({ status, search: newSearch, sortBy, dateFrom, dateTo });
    }, 300);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    onFilterChange({ status, search, sortBy: value, dateFrom, dateTo });
  };

  const handleDateFromChange = (date: Date | undefined) => {
    setDateFrom(date);
    onFilterChange({ status, search, sortBy, dateFrom: date, dateTo });
  };

  const handleDateToChange = (date: Date | undefined) => {
    setDateTo(date);
    onFilterChange({ status, search, sortBy, dateFrom, dateTo: date });
  };

  const handleClearFilters = () => {
    const defaultFilters = { status: [], search: "", sortBy: "created_desc", dateFrom: undefined, dateTo: undefined };
    setStatus(defaultFilters.status);
    setSearch(defaultFilters.search);
    setSortBy(defaultFilters.sortBy);
    setDateFrom(defaultFilters.dateFrom);
    setDateTo(defaultFilters.dateTo);
    onFilterChange(defaultFilters);
  };

  const getStatusDisplayText = () => {
    if (status.length === 0) return "All Statuses";
    if (status.length === 1) {
      const statusOption = statusOptions.find(opt => opt.value === status[0]);
      return statusOption?.label || status[0];
    }
    return `${status.length} statuses selected`;
  };

  const getDateDisplayText = () => {
    if (!dateFrom && !dateTo) return "All Dates";
    if (dateFrom && dateTo) return `${format(dateFrom, "MMM d")} - ${format(dateTo, "MMM d")}`;
    if (dateFrom) return `From ${format(dateFrom, "MMM d")}`;
    if (dateTo) return `Until ${format(dateTo, "MMM d")}`;
    return "All Dates";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex flex-col md:flex-row gap-4 flex-1">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search by customer name, order ID, bike details, or tracking number..."
              value={search}
              onChange={handleSearchChange}
              className="pl-10"
            />
          </div>
          
          <div className="flex flex-col md:flex-row gap-3">
            <div className="w-full md:w-48">
              <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={statusPopoverOpen}
                    className="w-full justify-between"
                  >
                    <div className="flex items-center">
                      <Filter className="mr-2 h-4 w-4" />
                      <span className="truncate">{getStatusDisplayText()}</span>
                    </div>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0">
                  <div className="p-4 space-y-2">
                    <div className="text-sm font-medium mb-3">Filter by Status</div>
                    {status.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {status.map((selectedStatus) => {
                          const statusOption = statusOptions.find(opt => opt.value === selectedStatus);
                          return (
                            <Badge 
                              key={selectedStatus} 
                              variant="secondary" 
                              className="text-xs cursor-pointer"
                              onClick={() => handleStatusToggle(selectedStatus)}
                            >
                              {statusOption?.label}
                              <span className="ml-1">×</span>
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                    <div className="space-y-1">
                      {statusOptions.map((option) => (
                        <div
                          key={option.value}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-muted rounded-sm p-2"
                          onClick={() => handleStatusToggle(option.value)}
                        >
                          <div className="w-4 h-4 border border-muted-foreground rounded flex items-center justify-center">
                            {status.includes(option.value) && (
                              <Check className="h-3 w-3" />
                            )}
                          </div>
                          <span className="text-sm">{option.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="w-full md:w-48">
              <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                  >
                    <div className="flex items-center">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      <span className="truncate">{getDateDisplayText()}</span>
                    </div>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-4 space-y-4">
                    <div className="text-sm font-medium">Filter by Date Range</div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground">From Date</label>
                        <div className="mt-1">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !dateFrom && "text-muted-foreground"
                                )}
                              >
                                {dateFrom ? format(dateFrom, "PPP") : "Select start date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={dateFrom}
                                onSelect={handleDateFromChange}
                                initialFocus
                                className={cn("p-3 pointer-events-auto")}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">To Date</label>
                        <div className="mt-1">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !dateTo && "text-muted-foreground"
                                )}
                              >
                                {dateTo ? format(dateTo, "PPP") : "Select end date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={dateTo}
                                onSelect={handleDateToChange}
                                initialFocus
                                className={cn("p-3 pointer-events-auto")}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      {(dateFrom || dateTo) && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setDateFrom(undefined);
                            setDateTo(undefined);
                            onFilterChange({ status, search, sortBy, dateFrom: undefined, dateTo: undefined });
                          }}
                          className="w-full"
                        >
                          Clear Date Filter
                        </Button>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="w-full md:w-48">
              <Select value={sortBy} onValueChange={handleSortChange}>
                <SelectTrigger>
                  {sortBy.includes("desc") ? (
                    <SortDesc className="mr-2 h-4 w-4" />
                  ) : (
                    <SortAsc className="mr-2 h-4 w-4" />
                  )}
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button variant="outline" onClick={handleClearFilters}>
              Clear Filters
            </Button>
          </div>
        </div>
        
        <Button asChild className="w-full lg:w-auto">
          <Link to="/create-order">
            <Plus className="mr-2 h-4 w-4" />
            New Order
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default OrderFilters;
