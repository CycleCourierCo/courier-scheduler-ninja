
import React from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Plus, Calendar } from "lucide-react";

const DashboardHeader: React.FC = () => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground">
          Manage your delivery orders
        </p>
      </div>
      <div className="flex space-x-2">
        <Button asChild variant="outline">
          <Link to="/job-scheduling">
            <Calendar className="mr-2 h-4 w-4" />
            Job Scheduling
          </Link>
        </Button>
        <Button asChild>
          <Link to="/create-order">
            <Plus className="mr-2 h-4 w-4" />
            New Order
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default DashboardHeader;
