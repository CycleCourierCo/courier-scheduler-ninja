
import React from "react";
import { Button } from "@/components/ui/button";

interface ResetEmailSentProps {
  email: string;
  onBack: () => void;
}

const ResetEmailSent = ({ email, onBack }: ResetEmailSentProps) => {
  return (
    <div className="text-center space-y-4 py-4">
      <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
        <h3 className="font-medium text-green-800 mb-2">Reset Email Sent</h3>
        <p className="text-green-700">
          We've sent a password reset link to <strong>{email}</strong>.
          Please check your email and follow the instructions to reset your password.
        </p>
      </div>
      <Button 
        onClick={onBack} 
        variant="outline"
        className="mt-4"
      >
        Back to Login
      </Button>
    </div>
  );
};

export default ResetEmailSent;
