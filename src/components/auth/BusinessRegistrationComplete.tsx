
import React from "react";
import { Button } from "@/components/ui/button";

interface BusinessRegistrationCompleteProps {
  onReturnToLogin: () => void;
}

const BusinessRegistrationComplete = ({ onReturnToLogin }: BusinessRegistrationCompleteProps) => {
  return (
    <div className="text-center space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-4">
        <h3 className="font-medium text-amber-800 mb-2">Business Account Registration Complete</h3>
        <p className="text-amber-700">
          Your business account application has been submitted successfully. An administrator will review your 
          application and you'll receive an email when your account is approved.
        </p>
      </div>
      <Button 
        onClick={onReturnToLogin} 
        className="bg-courier-600 hover:bg-courier-700"
      >
        Return to Login
      </Button>
    </div>
  );
};

export default BusinessRegistrationComplete;
