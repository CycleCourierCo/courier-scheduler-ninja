import React, { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { hasRole, getRoles } from "@/lib/roles";
import { useRoutePermissions } from "@/hooks/useRoutePermissions";

import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  noB2CAccess?: boolean;
}

const NoAccessScreen: React.FC = () => {
  const { signOut } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="rounded-full bg-muted p-4">
        <Lock className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-semibold">Access unavailable</h1>
      <p className="max-w-md text-muted-foreground">
        Your account doesn't have access to this portal. If you need help with an order,
        please contact us at info@cyclecourierco.com or +44 121 798 0767.
      </p>
      <Button variant="outline" onClick={() => signOut()}>Sign out</Button>
    </div>
  );
};

/**
 * ProtectedRoute handles all route authorization.
 * Admins always have full access. Every other role's access is driven by the
 * role/route permission matrix (admin-editable at /admin/route-permissions).
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  adminOnly = false,
}) => {
  const { user, isLoading, userProfile } = useAuth();
  const location = useLocation();
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const roles = getRoles(userProfile);
  const { isLoading: permsLoading, canAccess, allowedPages } = useRoutePermissions(roles);

  // Public pages that skip authentication entirely
  const isSenderAvailabilityPage = location.pathname.includes('/sender-availability/');
  const isReceiverAvailabilityPage = location.pathname.includes('/receiver-availability/');

  useEffect(() => {
    if (userProfile !== null || !isLoading) {
      setInitialLoadComplete(true);
    }
  }, [userProfile, isLoading]);

  if (isSenderAvailabilityPage || isReceiverAvailabilityPage) {
    return <>{children}</>;
  }

  if (isLoading || !initialLoadComplete) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-courier-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Admin short-circuit — full access
  if (hasRole(userProfile, 'admin')) {
    return <>{children}</>;
  }

  // B2C-only accounts have no portal access at all
  if (roles.length === 0 || roles.every(r => r === 'b2c_customer')) {
    return <NoAccessScreen />;
  }

  // Business accounts must be approved
  if (userProfile?.is_business && userProfile?.account_status !== 'approved') {
    return <Navigate to="/auth" replace />;
  }

  if (permsLoading) {

    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-courier-600"></div>
      </div>
    );
  }

  if (canAccess(location.pathname)) {
    return <>{children}</>;
  }

  // Not allowed — send them to their first permitted page, else show no-access
  const fallback = allowedPages[0]?.path;
  if (fallback && fallback !== location.pathname) {
    return <Navigate to={fallback} replace />;
  }
  return <NoAccessScreen />;
};

export default ProtectedRoute;
