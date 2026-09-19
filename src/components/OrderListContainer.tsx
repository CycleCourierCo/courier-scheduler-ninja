import { memo } from "react";

import OrderCardList from "./OrderCardList";
import EmptyOrdersState from "./EmptyOrdersState";
import { Order } from "@/types/order";

interface OrderListContainerProps {
  orders: Order[];
  userRole: string | null;
  totalCount: number;
  loading: boolean;
  onClearFilters: () => void;
}

const OrderListContainer = memo(({ 
  orders, 
  userRole, 
  totalCount, 
  loading,
  onClearFilters 
}: OrderListContainerProps) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-muted border-t-primary"></div>
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <EmptyOrdersState 
        hasOrders={false}
        onClearFilters={onClearFilters} 
      />
    );
  }

  return <OrderCardList orders={orders} userRole={userRole} />;


});

OrderListContainer.displayName = 'OrderListContainer';

export default OrderListContainer;
