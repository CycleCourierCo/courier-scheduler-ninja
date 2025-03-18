
import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  
  // Check if the current path is a public page that skips authentication
  const isSenderAvailabilityPage = location.pathname.includes('/sender-availability/');
  const isReceiverAvailabilityPage = location.pathname.includes('/receiver-availability/');
  
  // Skip authentication for public pages
  if (isSenderAvailabilityPage || isReceiverAvailabilityPage) {
    return <>{children}</>;
  }

  // Effect to ensure we've checked authentication at least once
  useEffect(() => {
    if (!isLoading) {
      setIsAuthChecked(true);
    }
  }, [isLoading]);

  // Only show loading when still authenticating and not yet checked
  if (isLoading && !isAuthChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-courier-600"></div>
      </div>
    );
  }

  // Redirect to auth page if user is not authenticated but we've checked auth
  if (!user && isAuthChecked) {
    console.log("User not authenticated, redirecting to /auth");
    return <Navigate to="/auth" replace />;
  }

  // Only render children when user is authenticated or we're still loading
  return <>{children}</>;
};

export default ProtectedRoute;
