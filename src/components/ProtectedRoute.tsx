
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
  
  // Debug logs
  console.log("ProtectedRoute - Current path:", location.pathname);
  console.log("ProtectedRoute - isApproved:", isApproved);
  console.log("ProtectedRoute - userProfile:", userProfile);
  
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

  // If on the awaiting approval page but already approved, redirect to dashboard
  if (isAwaitingApprovalPage && isApproved) {
    console.log("User is approved, redirecting from awaiting approval to dashboard");
    return <Navigate to="/dashboard" replace />;
  }

  // B2C customers don't need approval, so redirect to dashboard
  if (requiresApproval && userProfile?.role === 'b2c_customer' && isAwaitingApprovalPage) {
    console.log("B2C customer on awaiting approval page, redirecting to dashboard");
    return <Navigate to="/dashboard" replace />;
  }

  // If approval is required and user is not approved, redirect to awaiting approval page
  // But skip this check if the user is already on the awaiting approval page or is a b2c customer
  if (requiresApproval && !isApproved && !isAwaitingApprovalPage && userProfile?.role !== 'b2c_customer') {
    console.log("User is not approved, redirecting to awaiting approval page");
    return <Navigate to="/awaiting-approval" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
