
import React, { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiresApproval?: boolean;
  adminOnly?: boolean;
  noB2CAccess?: boolean;
}

/**
 * ProtectedRoute handles all route authorization logic
 * It implements strict rules to prevent unauthorized access
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiresApproval = true,
  adminOnly = false,
  noB2CAccess = false
}) => {
  const { user, isLoading, isApproved, userProfile } = useAuth();
  const location = useLocation();
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  // Check if the current path is a public page that skips authentication
  const isSenderAvailabilityPage = location.pathname.includes('/sender-availability/');
  const isReceiverAvailabilityPage = location.pathname.includes('/receiver-availability/');
  const isAwaitingApprovalPage = location.pathname === '/awaiting-approval';
  
  // Debug logs
  console.log("ProtectedRoute - Current path:", location.pathname);
  console.log("ProtectedRoute - isApproved:", isApproved);
  console.log("ProtectedRoute - userProfile:", userProfile);
  console.log("ProtectedRoute - userRole:", userProfile?.role);
  console.log("ProtectedRoute - is B2C customer:", userProfile?.role === 'b2c_customer');

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

  // ----------------------------------------------------
  // CRITICAL: B2C ACCESS CHECKS
  // ----------------------------------------------------
  
  // 3. Block B2C users from certain pages immediately
  // B2C users should NEVER see awaiting approval page or other restricted pages
  if (userProfile?.role === 'b2c_customer') {
    // If attempting to access awaiting approval or other restricted page, redirect
    if (isAwaitingApprovalPage || noB2CAccess) {
      console.log("B2C user attempted to access restricted page, redirecting to dashboard");
      return <Navigate to="/dashboard" replace />;
    }
  }

  // 4. Admin-only route protection
  if (adminOnly && userProfile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // 5. Approved users shouldn't see the awaiting approval page
  if (isAwaitingApprovalPage && isApproved) {
    return <Navigate to="/dashboard" replace />;
  }

  // 6. Route B2B users to awaiting approval page if needed
  if (requiresApproval && !isApproved && !isAwaitingApprovalPage && userProfile?.role !== 'b2c_customer') {
    return <Navigate to="/awaiting-approval" replace />;
  }

  // All checks passed, render the protected content
  return <>{children}</>;
};

export default ProtectedRoute;
