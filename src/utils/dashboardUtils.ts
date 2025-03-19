
import { Order } from "@/types/order";

export const sortOrders = (ordersToSort: Order[], sortBy: string) => {
  const sortedOrders = [...ordersToSort];
  
  switch (sortBy) {
    case "created_asc":
      return sortedOrders.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    case "created_desc":
      return sortedOrders.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case "sender_name":
      return sortedOrders.sort((a, b) => 
        a.sender.name.localeCompare(b.sender.name)
      );
    case "receiver_name":
      return sortedOrders.sort((a, b) => 
        a.receiver.name.localeCompare(b.receiver.name)
      );
    default:
      return sortedOrders;
  }
};

export const applyFiltersToOrders = (
  orders: Order[], 
  filters: { status: string; search: string; sortBy: string }
) => {
  let result = [...orders];
  
  // Apply status filter
  if (filters.status !== "all") {
    result = result.filter(order => order.status === filters.status);
  }
  
  // Apply search filter
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    result = result.filter(order => 
      order.sender.name.toLowerCase().includes(searchLower) ||
      order.receiver.name.toLowerCase().includes(searchLower) ||
      order.id.toLowerCase().includes(searchLower) ||
      (order.bikeBrand && order.bikeBrand.toLowerCase().includes(searchLower)) ||
      (order.bikeModel && order.bikeModel.toLowerCase().includes(searchLower))
    );
  }
  
  // Apply sorting
  result = sortOrders(result, filters.sortBy);
  
  return result;
};
