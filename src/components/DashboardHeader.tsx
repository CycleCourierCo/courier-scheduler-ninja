
import React from "react";

interface DashboardHeaderProps {
  children?: React.ReactNode;
  userRole?: string | null;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ 
  children,
  userRole
}) => {
  return (
    <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
      {children || (
        <div>
          <h1>Orders</h1>
          <p className="text-muted-foreground">
            Manage your delivery orders
          </p>
        </div>
      )}
    </div>
  );
};

export default DashboardHeader;
