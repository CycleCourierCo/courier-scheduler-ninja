
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
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
      {children || (
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            Manage your delivery orders
          </p>
        </div>
      )}
    </div>
  );
};

export default DashboardHeader;
