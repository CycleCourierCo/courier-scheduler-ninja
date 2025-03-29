
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

  // Bail early for public pages 
  if (isSenderAvailabilityPage || isReceiverAvailabilityPage) {
    return <>{children}</>;
  }
  
  // We need to handle several scenarios BEFORE allowing any rendering
  
  // 1. Still loading auth state - show loading spinner
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-courier-600"></div>
      </div>
    );
  }
  
  // 2. No authenticated user - redirect to login
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  // 3. B2C access restrictions - completely prevent access to certain pages
  if (userProfile?.role === 'b2c_customer' && (noB2CAccess || isAwaitingApprovalPage)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  // 4. Admin-only route protection
  if (adminOnly && userProfile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  
  // 5. Approved users shouldn't see the awaiting approval page
  if (isAwaitingApprovalPage && isApproved) {
    return <Navigate to="/dashboard" replace />;
  }
  
  // 6. Unapproved business users that need to be on the awaiting approval page
  if (requiresApproval && !isApproved && !isAwaitingApprovalPage && userProfile?.role !== 'b2c_customer') {
    return <Navigate to="/awaiting-approval" replace />;
  }
  
  // Only render the protected content if all checks pass
  return <>{children}</>;
};

export default ProtectedRoute;
