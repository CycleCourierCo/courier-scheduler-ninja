
import { useState } from "react";
import { Search, Filter, SortDesc, SortAsc } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "created", label: "Created" },
  { value: "sender_availability_pending", label: "Sender Availability Pending" },
  { value: "receiver_availability_pending", label: "Receiver Availability Pending" },
  { value: "receiver_availability_confirmed", label: "Receiver Availability Confirmed" },
  { value: "scheduled", label: "Scheduled" },
  { value: "picked_up", label: "Picked Up" },
  { value: "in_transit", label: "In Transit" },
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
    status: string;
    search: string;
    sortBy: string;
  }) => void;
  initialFilters?: {
    status: string;
    search: string;
    sortBy: string;
  };
}

const OrderFilters: React.FC<OrderFiltersProps> = ({ 
  onFilterChange, 
  initialFilters = { status: "all", search: "", sortBy: "created_desc" }
}) => {
  const [status, setStatus] = useState<string>(initialFilters.status);
  const [search, setSearch] = useState<string>(initialFilters.search);
  const [sortBy, setSortBy] = useState<string>(initialFilters.sortBy);

  const handleStatusChange = (value: string) => {
    setStatus(value);
    onFilterChange({ status: value, search, sortBy });
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
    const defaultFilters = { status: "all", search: "", sortBy: "created_desc" };
    setStatus(defaultFilters.status);
    setSearch(defaultFilters.search);
    setSortBy(defaultFilters.sortBy);
    onFilterChange(defaultFilters);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search orders..."
            value={search}
            onChange={handleSearchChange}
            className="pl-10"
          />
        </div>
        
        <div className="flex flex-col md:flex-row gap-3">
          <div className="w-full md:w-48">
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
