
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

  // Use an effect to handle immediate redirects before render
  useEffect(() => {
    // For pages that B2C customers should never access
    if (!isLoading && userProfile?.role === 'b2c_customer' && (noB2CAccess || isAwaitingApprovalPage)) {
      navigate('/dashboard', { replace: true });
    }
    
    // For pages that require admin access
    if (!isLoading && adminOnly && userProfile?.role !== 'admin') {
      navigate('/dashboard', { replace: true });
    }
    
    // For approved users trying to access the awaiting approval page
    if (!isLoading && isAwaitingApprovalPage && isApproved) {
      navigate('/dashboard', { replace: true });
    }
    
    // For unapproved users trying to access protected pages
    if (!isLoading && requiresApproval && !isApproved && !isAwaitingApprovalPage && userProfile?.role !== 'b2c_customer') {
      navigate('/awaiting-approval', { replace: true });
    }
  }, [isLoading, userProfile, isApproved, isAwaitingApprovalPage, adminOnly, requiresApproval, noB2CAccess, navigate]);
  
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

  // Pre-render checks for immediate blocking
  
  // B2C customers should never see certain pages
  if ((isAwaitingApprovalPage || noB2CAccess) && userProfile?.role === 'b2c_customer') {
    return <Navigate to="/dashboard" replace />;
  }

  // If admin access is required, check if user is admin
  if (adminOnly && userProfile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // If on the awaiting approval page but already approved, redirect to dashboard
  if (isAwaitingApprovalPage && isApproved) {
    return <Navigate to="/dashboard" replace />;
  }

  // If approval is required and user is not approved, redirect to awaiting approval page
  // But skip this check if the user is already on the awaiting approval page or is a b2c customer
  if (requiresApproval && !isApproved && !isAwaitingApprovalPage && userProfile?.role !== 'b2c_customer') {
    return <Navigate to="/awaiting-approval" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
