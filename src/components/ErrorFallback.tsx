import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
}

const ErrorFallback = ({ error, resetError }: ErrorFallbackProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center max-w-md">
        <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h1>
        <p className="text-muted-foreground mb-6">
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
        </div>
      </div>
    </div>
  );
};

export default ErrorFallback;
