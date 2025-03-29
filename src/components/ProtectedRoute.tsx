
import React, { useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiresApproval?: boolean;
  adminOnly?: boolean;
  noB2CAccess?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiresApproval = true,
  adminOnly = false,
  noB2CAccess = false
}) => {
  const { user, isLoading, isApproved, userProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
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

  // Skip authentication for public pages
  if (isSenderAvailabilityPage || isReceiverAvailabilityPage) {
    return <>{children}</>;
  }

  // Show loading state while auth state is loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-courier-600"></div>
      </div>
    );
  }

  // Redirect to login if no user
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // EARLY PROTECTION: Check for B2C access restrictions before rendering anything
  if ((isAwaitingApprovalPage || noB2CAccess) && userProfile?.role === 'b2c_customer') {
    return <Navigate to="/dashboard" replace />;
  }

  // Admin-only route protection
  if (adminOnly && userProfile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // Approved users shouldn't see the awaiting approval page
  if (isAwaitingApprovalPage && isApproved) {
    return <Navigate to="/dashboard" replace />;
  }

  // Unapproved business users that need to be on the awaiting approval page
  if (requiresApproval && !isApproved && !isAwaitingApprovalPage && userProfile?.role !== 'b2c_customer') {
    return <Navigate to="/awaiting-approval" replace />;
  }

  // All checks passed, render the protected content
  return <>{children}</>;
};

export default ProtectedRoute;
