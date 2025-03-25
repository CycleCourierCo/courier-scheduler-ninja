
import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
    
    // Log additional debugging information
    console.error("Full URL:", window.location.href);
    console.error("Search params:", location.search);
    console.error("Hash:", location.hash);
  }, [location]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <h2 className="text-2xl font-semibold text-gray-800">Page Not Found</h2>
        
        <p className="text-gray-600 mt-2">
          We couldn't find the page you're looking for.
        </p>
        
        <Alert variant="destructive" className="mt-6 text-left">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            The requested resource could not be found: <strong>{location.pathname}</strong>
            <br />
            If you were accessing an order or function, it may have been deleted or may not exist.
          </AlertDescription>
        </Alert>
        
        <div className="mt-8 space-y-3">
          <Button className="w-full" asChild>
            <Link to="/dashboard">Go to Dashboard</Link>
          </Button>
          
          <Button variant="outline" className="w-full" asChild>
            <Link to="/">Return to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
