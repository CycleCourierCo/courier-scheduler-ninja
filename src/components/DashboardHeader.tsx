
import React from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Plus, Calendar, Truck } from "lucide-react";

interface DashboardHeaderProps {
  children?: React.ReactNode;
  showActionButtons?: boolean;
  userRole?: string | null;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ 
  children, 
  showActionButtons = false,
  userRole = null
}) => {
  const isAdmin = userRole === 'admin';


  return (
    <div className="flex flex-col space-y-4 pb-4">
      {children || (
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            Manage your delivery orders
          </p>
        </div>
      )}
      {showActionButtons && (
        <div className="flex flex-col sm:flex-row justify-end gap-2">
          {isAdmin && (
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link to="/scheduling">
                <Calendar className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Job Scheduling</span>
                <span className="sm:hidden">Scheduling</span>
              </Link>
            </Button>
          )}
          {isAdmin && (
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link to="/loading">
                <Truck className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Loading & Unloading</span>
                <span className="sm:hidden">Loading</span>
              </Link>
            </Button>
          )}
          <Button asChild className="w-full sm:w-auto">
            <Link to="/create-order">
              <Plus className="mr-2 h-4 w-4" />
              New Order
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
};

export default DashboardHeader;
