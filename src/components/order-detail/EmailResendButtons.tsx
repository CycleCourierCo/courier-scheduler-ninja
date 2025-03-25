
import React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";

interface EmailResendButtonsProps {
  needsSenderConfirmation: boolean;
  needsReceiverConfirmation: boolean;
  isResendingSender: boolean;
  isResendingReceiver: boolean;
  onResendSenderEmail: () => void;
  onResendReceiverEmail: () => void;
}

const EmailResendButtons: React.FC<EmailResendButtonsProps> = ({
  needsSenderConfirmation,
  needsReceiverConfirmation,
  isResendingSender,
  isResendingReceiver,
  onResendSenderEmail,
  onResendReceiverEmail,
}) => {
  if (!needsSenderConfirmation && !needsReceiverConfirmation) {
    return null;
  }

  return (
    <div className="flex space-x-2">
      {needsSenderConfirmation && (
        <Button 
          variant="outline" 
          size="sm"
          onClick={onResendSenderEmail}
          disabled={isResendingSender}
        >
          {isResendingSender ? (
            <div className="flex items-center space-x-1">
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-courier-600"></div>
              <span>Sending...</span>
            </div>
          ) : (
            <>
              <RefreshCcw className="mr-2 h-4 w-4" /> 
              Resend Sender Email
            </>
          )}
        </Button>
      )}
      {needsReceiverConfirmation && (
        <Button 
          variant="outline" 
          size="sm"
          onClick={onResendReceiverEmail}
          disabled={isResendingReceiver}
        >
          {isResendingReceiver ? (
            <div className="flex items-center space-x-1">
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-courier-600"></div>
              <span>Sending...</span>
            </div>
          ) : (
            <>
              <RefreshCcw className="mr-2 h-4 w-4" /> 
              Resend Receiver Email
            </>
          )}
        </Button>
      )}
    </div>
  );
};

export default EmailResendButtons;
