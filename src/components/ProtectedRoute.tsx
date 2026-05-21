
import React, { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { hasRole, getRoles } from "@/lib/roles";

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
  if (userProfile?.is_business && userProfile?.account_status !== 'approved' && !hasRole(userProfile, 'admin')) {
    return <Navigate to="/auth" replace />;
  }

  // Admin short-circuit — full access
  if (hasRole(userProfile, 'admin')) {
    if (noB2CAccess && getRoles(userProfile).every(r => r === 'b2c_customer')) {
      return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
  }

  // Compute which restricted-role pages are allowed for this user (union)
  const isLoadingPg = location.pathname === '/loading';
  const isBicycleInspectionsPage = location.pathname === '/bicycle-inspections';
  const isSchedulingPage = location.pathname === '/scheduling';
  const isDashboardPage = location.pathname === '/dashboard';
  const isOrderDetailPage = location.pathname.startsWith('/orders/');
  const isCustomerOrderDetailPage = location.pathname.startsWith('/customer-orders/');
  const isAIRoutingPage = location.pathname === '/ai-routing';
  const isApprovalsPage = location.pathname === '/account-approvals';
  const isInvoicesPage = location.pathname === '/invoices';
  const isTimeslipsPage = location.pathname === '/driver-timeslips';
  const isProfilePage = location.pathname === '/profile';
  const isFuelFinderPage = location.pathname === '/fuel-finder';
  const isUsersPage = location.pathname === '/users';
  const isEmailsPage = location.pathname === '/emails';

  const restrictedRoles = ['loader','mechanic','route_planner','sales','driver'] as const;
  const userRestricted = restrictedRoles.filter(r => hasRole(userProfile, r));

  if (userRestricted.length > 0) {
    const allowed = new Set<boolean>();
    let anyAllowed = false;

    for (const r of userRestricted) {
      if (r === 'loader' && isLoadingPg) anyAllowed = true;
      if (r === 'mechanic' && isBicycleInspectionsPage) anyAllowed = true;
      if (r === 'route_planner' && (isSchedulingPage || isDashboardPage || isOrderDetailPage || isCustomerOrderDetailPage || isAIRoutingPage)) anyAllowed = true;
      if (r === 'sales' && (isApprovalsPage || isInvoicesPage || isDashboardPage || isUsersPage || isProfilePage || isEmailsPage)) anyAllowed = true;
      if (r === 'driver' && (isTimeslipsPage || isProfilePage || isFuelFinderPage)) anyAllowed = true;
    }

    if (!anyAllowed) {
      // Pick a sensible default landing page based on first restricted role
      const fallback =
        userRestricted.includes('loader' as any) ? '/loading' :
        userRestricted.includes('mechanic' as any) ? '/bicycle-inspections' :
        userRestricted.includes('driver' as any) ? '/driver-timeslips' :
        '/dashboard';
      return <Navigate to={fallback} replace />;
    }
    return <>{children}</>;
  }

  // 9. Block B2C users from admin-only pages
  if (noB2CAccess && hasRole(userProfile, 'b2c_customer')) {
    return <Navigate to="/dashboard" replace />;
  }

  // 10. Admin-only route protection
  if (adminOnly && !hasRole(userProfile, 'admin')) {
    return <Navigate to="/dashboard" replace />;
  }

  // All checks passed, render the protected content
  return <>{children}</>;
};

export default ProtectedRoute;
