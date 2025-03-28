
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiresApproval?: boolean;
  adminOnly?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiresApproval = true,
  adminOnly = false 
}) => {
  const { user, isLoading, isApproved, userProfile } = useAuth();
  const location = useLocation();
  
  // Check if the current path is a public page that skips authentication
  const isSenderAvailabilityPage = location.pathname.includes('/sender-availability/');
  const isReceiverAvailabilityPage = location.pathname.includes('/receiver-availability/');
  const isAwaitingApprovalPage = location.pathname === '/awaiting-approval';
  
  // Skip authentication for public pages
  if (isSenderAvailabilityPage || isReceiverAvailabilityPage) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-courier-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If admin access is required, check if user is admin
  if (adminOnly && userProfile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // If approval is required and user is not approved, redirect to awaiting approval page
  if (requiresApproval && !isApproved && !isAwaitingApprovalPage) {
    return <Navigate to="/awaiting-approval" replace />;
  }

  // If on the awaiting approval page but already approved, redirect to dashboard
  if (isAwaitingApprovalPage && isApproved) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
