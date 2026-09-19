
import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MapPinOff } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("Page not found", location.pathname);
  }, [location]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md overflow-hidden rounded-md border bg-card shadow-card">
        <div className="signboard rounded-none"><MapPinOff className="mb-3 h-7 w-7" /><h1>Wrong turn</h1><p className="data-text mt-2 text-primary-foreground">404 · {location.pathname}</p></div>
        <div className="space-y-5 p-6"><p className="text-muted-foreground">We couldn't find this page. The link may be old, or the item may no longer exist.</p>
        
        <div className="space-y-3">
          <Button className="w-full" asChild>
            <Link to="/dashboard">Go to Dashboard</Link>
          </Button>
          
          <Button variant="outline" className="w-full" asChild>
            <Link to="/">Return to Home</Link>
          </Button>
        </div></div>
      </div>
    </div>
  );
};

export default NotFound;
