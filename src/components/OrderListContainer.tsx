import { memo } from "react";
import OrderTable from "./OrderTable";
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-courier-600"></div>
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

  return (
    <>
      <div className="md:hidden">
        <OrderCardList orders={orders} userRole={userRole} />
      </div>
      <div className="hidden md:block">
        <OrderTable orders={orders} userRole={userRole} />
      </div>
    </>
  );
});

OrderListContainer.displayName = 'OrderListContainer';

export default OrderListContainer;
