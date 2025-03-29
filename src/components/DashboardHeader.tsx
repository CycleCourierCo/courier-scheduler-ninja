import React from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Plus, Calendar } from "lucide-react";
interface DashboardHeaderProps {
  children?: React.ReactNode;
}
const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  children
}) => {
  return <div className="flex flex-col space-y-4 pb-4">
      {children || <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            Manage your delivery orders
          </p>
        </div>}
      <div className="flex justify-end space-x-2">
        <Button asChild variant="outline">
          
        </Button>
        <Button asChild>
          
        </Button>
      </div>
    </div>;
};
export default DashboardHeader;