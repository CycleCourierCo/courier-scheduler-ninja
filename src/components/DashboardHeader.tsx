
import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const DashboardHeader: React.FC = () => {
  return (
    <div className="flex justify-between items-center">
      <h1 className="text-2xl font-bold">Your Orders</h1>
      <Button asChild>
        <Link to="/create-order">Create New Order</Link>
      </Button>
    </div>
  );
};

export default DashboardHeader;
