
import { useState } from "react";
import { Search, Filter, SortDesc, SortAsc, Check } from "lucide-react";
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
  }) => void;
  initialFilters?: {
    status: string[];
    search: string;
    sortBy: string;
  };
}

const OrderFilters: React.FC<OrderFiltersProps> = ({ 
  onFilterChange, 
  initialFilters = { status: [], search: "", sortBy: "created_desc" }
}) => {
  const [status, setStatus] = useState<string[]>(initialFilters.status);
  const [search, setSearch] = useState<string>(initialFilters.search);
  const [sortBy, setSortBy] = useState<string>(initialFilters.sortBy);
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);

  const handleStatusToggle = (value: string) => {
    const newStatus = status.includes(value)
      ? status.filter(s => s !== value)
      : [...status, value];
    setStatus(newStatus);
    onFilterChange({ status: newStatus, search, sortBy });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    onFilterChange({ status, search: e.target.value, sortBy });
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    onFilterChange({ status, search, sortBy: value });
  };

  const handleClearFilters = () => {
    const defaultFilters = { status: [], search: "", sortBy: "created_desc" };
    setStatus(defaultFilters.status);
    setSearch(defaultFilters.search);
    setSortBy(defaultFilters.sortBy);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
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
    </div>
  );
};

export default OrderFilters;
