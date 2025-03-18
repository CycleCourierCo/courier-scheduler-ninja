
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: ('admin' | 'b2b_customer' | 'b2c_customer')[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRoles }) => {
  const { user, isLoading, userRole } = useAuth();
  const location = useLocation();
  
  // Check if the current path is a public page that skips authentication
  const isSenderAvailabilityPage = location.pathname.includes('/sender-availability/');
  const isReceiverAvailabilityPage = location.pathname.includes('/receiver-availability/');
  
  // Skip authentication for public pages
  if (isSenderAvailabilityPage || isReceiverAvailabilityPage) {
    return <>{children}</>;
  }

  // Timeout and error states
  const [showTimeout, setShowTimeout] = React.useState(false);
  const [showError, setShowError] = React.useState(false);
  
  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    let errorTimer: NodeJS.Timeout;
    
    if (isLoading) {
      timer = setTimeout(() => {
        setShowTimeout(true);
      }, 3000); // Show first message sooner
      
      errorTimer = setTimeout(() => {
        setShowError(true);
      }, 6000); // Show error message sooner
    } else {
      setShowTimeout(false);
      setShowError(false);
    }
    
    return () => {
      clearTimeout(timer);
      clearTimeout(errorTimer);
    };
  }, [isLoading]);

  // Redirect to auth if no user and no loading
  if (!isLoading && !user) {
    return <Navigate to="/auth" replace />;
  }

  // Special case: if we're stuck loading for too long, offer a way out
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-courier-600 mb-4"></div>
        <p className="text-gray-700 mb-2">Loading your session...</p>
        
        {showTimeout && (
          <div className="mt-4 text-center">
            <p className="text-amber-600 mb-2">Loading is taking longer than expected.</p>
            {!showError && (
              <p className="text-gray-600 text-sm mb-4">Please wait a few more moments...</p>
            )}
          </div>
        )}
        
        {showError && (
          <div className="mt-4 text-center">
            <p className="text-red-600 mb-2">We're having trouble loading your session.</p>
            <div className="flex space-x-3 mt-4">
              <button 
                className="px-4 py-2 bg-courier-600 text-white rounded hover:bg-courier-700"
                onClick={() => window.location.reload()}
              >
                Refresh page
              </button>
              <button
                className="px-4 py-2 border border-courier-600 text-courier-600 rounded hover:bg-courier-50"
                onClick={() => {
                  localStorage.removeItem('supabase.auth.token');
                  window.location.href = "/auth";
                }}
              >
                Go to login
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // If requiredRoles are specified, check if the user has one of them
  if (requiredRoles && requiredRoles.length > 0 && userRole) {
    if (!requiredRoles.includes(userRole)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
