
import React, { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const [redirecting, setRedirecting] = useState(false);
  
  // Check if the current path is a public page that skips authentication
  const isSenderAvailabilityPage = location.pathname.includes('/sender-availability/');
  const isReceiverAvailabilityPage = location.pathname.includes('/receiver-availability/');
  
  // Debug logs
  console.log("ProtectedRoute - Current path:", location.pathname);
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
  // Only perform redirect if we're not already redirecting to prevent loops
  if (!user && !redirecting) {
    setRedirecting(true);
    return <Navigate to="/auth" replace />;
  }

  // 3. Block B2C users from admin-only pages
  // Only perform redirect if we're not already redirecting to prevent loops
  if (noB2CAccess && userProfile?.role === 'b2c_customer' && !redirecting) {
    console.log("B2C user attempted to access restricted page, redirecting to dashboard");
    setRedirecting(true);
    return <Navigate to="/dashboard" replace />;
  }

  // 4. Admin-only route protection
  // Only perform redirect if we're not already redirecting to prevent loops
  if (adminOnly && userProfile?.role !== 'admin' && !redirecting) {
    setRedirecting(true);
    return <Navigate to="/dashboard" replace />;
  }

  // Reset redirecting state when we're rendering children
  // This ensures we can redirect again if necessary on future renders
  if (redirecting) {
    setRedirecting(false);
  }

  // All checks passed, render the protected content
  return <>{children}</>;
};

export default ProtectedRoute;
