import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
}

const ErrorFallback = ({ error, resetError }: ErrorFallbackProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md overflow-hidden rounded-md border bg-card shadow-card">
        <div className="signboard rounded-none"><AlertTriangle className="mb-3 h-7 w-7" /><h1>Something went wrong</h1></div>
        <div className="p-6 text-center"><p className="text-muted-foreground mb-6">
          We've been notified and are working to fix the issue.
        </p>
        <div className="flex gap-4 justify-center">
          <Button onClick={() => window.location.href = "/"}>
            Return to Home
          </Button>
          {resetError && (
            <Button variant="outline" onClick={resetError}>
              Try Again
            </Button>
          )}
        </div></div>
      </div>
    </div>
  );
};

export default ErrorFallback;
