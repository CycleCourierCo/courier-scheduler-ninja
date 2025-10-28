
import React, { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  noB2CAccess?: boolean;
}

/**
 * ProtectedRoute handles all route authorization logic
 * It implements strict rules to prevent unauthorized access
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  adminOnly = false,
  noB2CAccess = false
}) => {
  const { user, isLoading, userProfile } = useAuth();
  const location = useLocation();
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  // Check if the current path is a public page that skips authentication
  const isSenderAvailabilityPage = location.pathname.includes('/sender-availability/');
  const isReceiverAvailabilityPage = location.pathname.includes('/receiver-availability/');
  const isLoadingPage = location.pathname === '/loading';
  

  // Set initialLoadComplete after the first profile load
  useEffect(() => {
    if (userProfile !== null || !isLoading) {
      setInitialLoadComplete(true);
    }
  }, [userProfile, isLoading]);

  // 0. Public routes skip all authorization
  if (isSenderAvailabilityPage || isReceiverAvailabilityPage) {
    return <>{children}</>;
  }

  // 1. Show loading state while initial auth check is in progress
  // This prevents any redirects during the initial loading
  if (isLoading || !initialLoadComplete) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-courier-600"></div>
      </div>
    );
  }

  // 2. No authenticated user - must redirect to login
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // 3. Business account status check - if not approved, redirect to dashboard
  if (userProfile?.is_business && userProfile?.account_status !== 'approved' && userProfile?.role !== 'admin') {
    return <Navigate to="/auth" replace />;
  }

  // 4. Loader role restrictions - only allow access to loading page
  if (userProfile?.role === 'loader') {
    if (!isLoadingPage) {
      return <Navigate to="/loading" replace />;
    }
    // If they're on the loading page, allow access
    return <>{children}</>;
  }

  // 5. Route planner role restrictions - only allow scheduling and dashboard
  const isSchedulingPage = location.pathname === '/scheduling';
  const isDashboardPage = location.pathname === '/dashboard';
  if (userProfile?.role === 'route_planner') {
    if (!isSchedulingPage && !isDashboardPage) {
      return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
  }

  // 6. Sales role restrictions - only allow approvals, invoices, and dashboard
  const isApprovalsPage = location.pathname === '/account-approvals';
  const isInvoicesPage = location.pathname === '/invoices';
  if (userProfile?.role === 'sales') {
    if (!isApprovalsPage && !isInvoicesPage && !isDashboardPage) {
      return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
  }

  // 7. Driver role restrictions - only allow timeslips and profile
  const isTimeslipsPage = location.pathname === '/driver-timeslips';
  const isProfilePage = location.pathname === '/profile';
  if (userProfile?.role === 'driver') {
    if (!isTimeslipsPage && !isProfilePage) {
      return <Navigate to="/driver-timeslips" replace />;
    }
    return <>{children}</>;
  }

  // 8. Block B2C users from admin-only pages
  if (noB2CAccess && userProfile?.role === 'b2c_customer') {
    return <Navigate to="/dashboard" replace />;
  }

  // 9. Admin-only route protection
  if (adminOnly && userProfile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // All checks passed, render the protected content
  return <>{children}</>;
};

export default ProtectedRoute;
