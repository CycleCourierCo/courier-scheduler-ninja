
import React, { useEffect, useState } from "react";
import { getAllJobs, Job, JobType } from "@/services/jobService";
import { getOrders } from "@/services/orderService";
import { Order } from "@/types/order";
import { toast } from "sonner";
import { format } from "date-fns";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import {
  FilterIcon,
  SortDesc,
  SortAsc,
  Truck,
  Box,
  User,
  Search,
  CalendarDays,
  MapPin,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "react-router-dom";

const JobsPage: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [orders, setOrders] = useState<Record<string, Order>>({});
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: "all",
    search: "",
    orderStatus: "all",
    sortBy: "created_desc",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch all jobs
      const allJobs = await getAllJobs();
      setJobs(allJobs);
      
      // Fetch orders data to display additional information
      const allOrders = await getOrders();
      const ordersMap: Record<string, Order> = {};
      allOrders.forEach(order => {
        ordersMap[order.id] = order;
      });
      setOrders(ordersMap);
    } catch (error) {
      console.error("Error fetching jobs data:", error);
      toast.error("Failed to load jobs data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Apply filters when jobs or filters change
  useEffect(() => {
    let result = [...jobs];
    
    // Filter by job type
    if (filters.type !== "all") {
      result = result.filter(job => job.type === filters.type);
    }
    
    // Filter by order status
    if (filters.orderStatus !== "all") {
      result = result.filter(job => {
        const order = orders[job.order_id];
        return order && order.status === filters.orderStatus;
      });
    }
    
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(job => {
        const order = orders[job.order_id];
        
        return (
          job.location.toLowerCase().includes(searchLower) ||
          job.order_id.toLowerCase().includes(searchLower) ||
          (order && (
            order.sender.name.toLowerCase().includes(searchLower) || 
            order.receiver.name.toLowerCase().includes(searchLower) ||
            (order.bikeBrand && order.bikeBrand.toLowerCase().includes(searchLower)) ||
            (order.bikeModel && order.bikeModel.toLowerCase().includes(searchLower))
          ))
        );
      });
    }
    
    // Sorting
    switch (filters.sortBy) {
      case "created_asc":
        result.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
        break;
      case "created_desc":
        result.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
        break;
      case "location":
        result.sort((a, b) => a.location.localeCompare(b.location));
        break;
      case "type":
        result.sort((a, b) => a.type.localeCompare(b.type));
        break;
      default:
        break;
    }
    
    setFilteredJobs(result);
  }, [jobs, filters, orders]);

  const handleFilterChange = (
    filterName: keyof typeof filters,
    value: string
  ) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value,
    }));
  };

  const handleResetFilters = () => {
    setFilters({
      type: "all",
      search: "",
      orderStatus: "all",
      sortBy: "created_desc",
    });
  };

  const getJobTypeIcon = (type: JobType) => {
    return type === "collection" ? (
      <Box className="w-5 h-5 text-blue-500" />
    ) : (
      <Truck className="w-5 h-5 text-green-500" />
    );
  };

  const getJobTypeLabel = (type: JobType) => {
    return type === "collection" ? "Collection" : "Delivery";
  };

  // Map orders status options
  const statusOptions = [
    { value: "all", label: "All Statuses" },
    { value: "created", label: "Created" },
    { value: "sender_availability_pending", label: "Sender Availability Pending" },
    { value: "sender_availability_confirmed", label: "Sender Confirmed" },
    { value: "receiver_availability_pending", label: "Receiver Availability Pending" },
    { value: "receiver_availability_confirmed", label: "Receiver Confirmed" },
    { value: "scheduled_dates_pending", label: "Scheduled Dates Pending" },
    { value: "scheduled", label: "Scheduled" },
    { value: "driver_to_collection", label: "Driver to Collection" },
    { value: "collected", label: "Collected" },
    { value: "driver_to_delivery", label: "Driver to Delivery" },
    { value: "shipped", label: "Shipped" },
    { value: "delivered", label: "Delivered" },
    { value: "cancelled", label: "Cancelled" },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-courier-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
          <div>
            <h1 className="text-2xl font-bold">Jobs Management</h1>
            <p className="text-muted-foreground">
              View and manage all delivery and collection jobs
            </p>
          </div>
          <div className="flex space-x-2">
            <Button
              onClick={() => fetchData()}
              variant="outline"
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-background shadow rounded-lg p-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search jobs..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex flex-col md:flex-row gap-3">
              <Select
                value={filters.type}
                onValueChange={(value) => handleFilterChange("type", value)}
              >
                <SelectTrigger className="w-[180px]">
                  <FilterIcon className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Job Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="collection">Collection</SelectItem>
                    <SelectItem value="delivery">Delivery</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              
              <Select
                value={filters.orderStatus}
                onValueChange={(value) => handleFilterChange("orderStatus", value)}
              >
                <SelectTrigger className="w-[180px]">
                  <FilterIcon className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Order Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {statusOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              
              <Select
                value={filters.sortBy}
                onValueChange={(value) => handleFilterChange("sortBy", value)}
              >
                <SelectTrigger className="w-[180px]">
                  {filters.sortBy.includes("desc") ? (
                    <SortDesc className="w-4 h-4 mr-2" />
                  ) : (
                    <SortAsc className="w-4 h-4 mr-2" />
                  )}
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="created_desc">Newest First</SelectItem>
                    <SelectItem value="created_asc">Oldest First</SelectItem>
                    <SelectItem value="location">Location</SelectItem>
                    <SelectItem value="type">Job Type</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              
              <Button variant="outline" onClick={handleResetFilters}>
                Reset Filters
              </Button>
            </div>
          </div>
        </div>

        {/* Jobs Table */}
        <div className="bg-white dark:bg-background shadow rounded-lg">
          {filteredJobs.length === 0 ? (
            <div className="p-8 text-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                No jobs found
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {jobs.length === 0
                  ? "There are no jobs in the system yet."
                  : "Try adjusting your filters to find what you're looking for."}
              </p>
              {jobs.length > 0 && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={handleResetFilters}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job Type</TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Order Status</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Preferred Dates</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map((job) => {
                    const order = orders[job.order_id];
                    const contact = job.type === "collection" 
                      ? order?.sender 
                      : order?.receiver;
                    
                    return (
                      <TableRow key={job.id}>
                        <TableCell>
                          <div className="flex items-center">
                            {getJobTypeIcon(job.type as JobType)}
                            <span className="ml-2">{getJobTypeLabel(job.type as JobType)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Link
                            to={`/orders/${job.order_id}`}
                            className="text-courier-600 hover:underline"
                          >
                            {job.order_id.substring(0, 8)}...
                          </Link>
                        </TableCell>
                        <TableCell>
                          {order ? (
                            <StatusBadge status={order.status} />
                          ) : (
                            <span className="text-gray-400">Unknown</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-1 text-gray-500" />
                            <span className="truncate max-w-[200px]">
                              {job.location}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {contact ? (
                            <div className="flex items-center">
                              <User className="w-4 h-4 mr-1 text-gray-500" />
                              <span>{contact.name}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">Unknown</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {job.preferred_date && job.preferred_date.length > 0 ? (
                            <div className="flex items-center">
                              <CalendarDays className="w-4 h-4 mr-1 text-gray-500" />
                              <span>
                                {job.preferred_date.length} date{job.preferred_date.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">No dates</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {format(job.created_at, "PP")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <Link to={`/orders/${job.order_id}`}>
                              View Order
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default JobsPage;
