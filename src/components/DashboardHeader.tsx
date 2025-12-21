
import React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface DashboardHeaderProps {
  children?: React.ReactNode;
  onSyncToOptimoRoute?: () => void;
  isSyncingOptimoRoute?: boolean;
  userRole?: string | null;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ 
  children,
  onSyncToOptimoRoute,
  isSyncingOptimoRoute = false,
  userRole
}) => {
  const isAdmin = userRole === 'admin';

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
      
      {isAdmin && onSyncToOptimoRoute && (
        <Button 
          onClick={onSyncToOptimoRoute}
          disabled={isSyncingOptimoRoute}
          variant="outline"
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncingOptimoRoute ? 'animate-spin' : ''}`} />
          {isSyncingOptimoRoute ? "Syncing..." : "Sync to OptimoRoute"}
        </Button>
      )}
    </div>
  );
};

export default DashboardHeader;
