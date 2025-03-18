
import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader, AlertCircle } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const [authTimeoutReached, setAuthTimeoutReached] = useState(false);
  
  // Check if the current path is a public page that skips authentication
  const isSenderAvailabilityPage = location.pathname.includes('/sender-availability/');
  const isReceiverAvailabilityPage = location.pathname.includes('/receiver-availability/');
  
  // Skip authentication for public pages
  if (isSenderAvailabilityPage || isReceiverAvailabilityPage) {
    return <>{children}</>;
  }

  useEffect(() => {
    console.log("ProtectedRoute - auth state:", { isLoading, user: !!user, path: location.pathname });
    
    // Set a timeout to detect if authentication is taking too long
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        console.log("Authentication timeout reached, showing timeout message");
        setAuthTimeoutReached(true);
      }
    }, 8000); // 8 second timeout
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [isLoading, user, location.pathname]);

  // Show timeout message if authentication is taking too long
  if (isLoading && authTimeoutReached) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AlertCircle className="h-12 w-12 text-amber-600 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Authentication is taking longer than expected</h2>
        <p className="text-gray-600 text-center mb-6">
          This could be due to a network issue or server problem. You can refresh the page to try again.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-courier-600 text-white rounded-md hover:bg-courier-700 transition-colors"
        >
          Refresh Page
        </button>
      </div>
    );
  }

  // Show loading state while checking authentication - with a timeout to prevent infinite loading
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader className="h-12 w-12 text-courier-600 animate-spin mb-4" />
        <p className="text-gray-600">Loading your account...</p>
      </div>
    );
  }

  // Redirect to auth page if user is not authenticated
  if (!user) {
    console.log("User not authenticated, redirecting to /auth");
    return <Navigate to="/auth" replace />;
  }

  // User is authenticated, render children
  console.log("User authenticated, rendering children");
  return <>{children}</>;
};

export default ProtectedRoute;
