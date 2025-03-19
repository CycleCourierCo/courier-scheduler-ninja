
import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = "Loading order details..." }) => (
  <div className="flex items-center justify-center h-full">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <span className="ml-2">{message}</span>
  </div>
);

interface ErrorStateProps {
  error: string;
  onHome: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ error, onHome }) => {
  const isAlreadyConfirmed = error === "already_confirmed";
  const isConfirmationSuccess = error === "availability_confirmed";
  
  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          {isAlreadyConfirmed 
            ? "Availability Already Confirmed" 
            : isConfirmationSuccess
            ? "Availability Confirmed Successfully"
            : "Error"}
          {!isAlreadyConfirmed && !isConfirmationSuccess && (
            <AlertCircle className="ml-2 h-5 w-5 text-destructive" />
          )}
        </CardTitle>
        <CardDescription>
          {isAlreadyConfirmed
            ? "Thank you for confirming your availability. We have already received your time preference."
            : isConfirmationSuccess
            ? "Thank you for confirming your availability. We will proceed with your delivery arrangements."
            : error}
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button onClick={onHome} className="w-full">
          Return to Home
        </Button>
      </CardFooter>
    </Card>
  );
};
