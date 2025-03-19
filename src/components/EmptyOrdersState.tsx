
import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface EmptyOrdersStateProps {
  hasOrders: boolean;
  onClearFilters: () => void;
}

const EmptyOrdersState: React.FC<EmptyOrdersStateProps> = ({ hasOrders, onClearFilters }) => {
  return (
    <div className="bg-gray-50 rounded-lg p-8 text-center">
      <h2 className="text-xl font-semibold mb-4">No Orders Found</h2>
      <p className="text-gray-600 mb-6">
        {!hasOrders 
          ? "You haven't created any orders yet. Start by creating your first order."
          : "No orders match your current filters. Try adjusting your search or filter settings."}
      </p>
      {!hasOrders ? (
        <Button asChild>
          <Link to="/create-order">Create Your First Order</Link>
        </Button>
      ) : (
        <Button variant="outline" onClick={onClearFilters}>
          Clear Filters
        </Button>
      )}
    </div>
  );
};

export default EmptyOrdersState;
